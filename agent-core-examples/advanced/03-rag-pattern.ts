import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class RAGPatternStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const documentBucket = new s3.Bucket(this, 'DocumentBucket', {
      bucketName: `rag-documents-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    });

    const kbRole = new iam.Role(this, 'KnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    documentBucket.grantRead(kbRole);

    kbRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'aoss:APIAccessAll'],
      resources: ['*'],
    }));

    const collectionName = 'rag-collection';

    const encryptionPolicy = new opensearch.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: `${collectionName}-enc`,
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }],
        AWSOwnedKey: true,
      }),
    });

    const networkPolicy = new opensearch.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: `${collectionName}-net`,
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [
            { ResourceType: 'collection', Resource: [`collection/${collectionName}`] },
            { ResourceType: 'dashboard', Resource: [`collection/${collectionName}`] },
          ],
          AllowFromPublic: true,
        },
      ]),
    });

    const collection = new opensearch.CfnCollection(this, 'RAGCollection', {
      name: collectionName,
      type: 'VECTORSEARCH',
    });

    collection.addDependency(encryptionPolicy);
    collection.addDependency(networkPolicy);

    const dataAccessPolicy = new opensearch.CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: `${collectionName}-access`,
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${collectionName}`],
              Permission: ['aoss:CreateCollectionItems', 'aoss:DeleteCollectionItems', 
                          'aoss:UpdateCollectionItems', 'aoss:DescribeCollectionItems'],
            },
            {
              ResourceType: 'index',
              Resource: [`index/${collectionName}/*`],
              Permission: ['aoss:CreateIndex', 'aoss:DeleteIndex', 'aoss:UpdateIndex',
                          'aoss:DescribeIndex', 'aoss:ReadDocument', 'aoss:WriteDocument'],
            },
          ],
          Principal: [kbRole.roleArn],
        },
      ]),
    });

    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'RAGKnowledgeBase', {
      name: 'rag-knowledge-base',
      roleArn: kbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v1`,
        },
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: collection.attrArn,
          vectorIndexName: 'rag-index',
          fieldMapping: {
            vectorField: 'vector',
            textField: 'text',
            metadataField: 'metadata',
          },
        },
      },
    });

    knowledgeBase.addDependency(dataAccessPolicy);

    new bedrock.CfnDataSource(this, 'S3DataSource', {
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      name: 's3-documents',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: documentBucket.bucketArn,
        },
      },
    });

    const retrievalLambda = new lambda.Function(this, 'RetrievalHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      code: lambda.Code.fromInline(`
import json
import boto3

bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

def handler(event, context):
    """
    Enhanced retrieval with custom processing
    """
    action = event.get('actionGroup')
    api_path = event.get('apiPath')
    parameters = event.get('parameters', [])
    
    query = next((p['value'] for p in parameters if p['name'] == 'query'), None)
    max_results = int(next((p['value'] for p in parameters if p['name'] == 'maxResults'), '5'))
    
    if api_path == '/retrieve-documents' and query:
        try:
            response = bedrock_agent_runtime.retrieve(
                knowledgeBaseId='${knowledgeBase.attrKnowledgeBaseId}',
                retrievalQuery={'text': query},
                retrievalConfiguration={
                    'vectorSearchConfiguration': {
                        'numberOfResults': max_results
                    }
                }
            )
            
            results = []
            for result in response.get('retrievalResults', []):
                results.append({
                    'content': result.get('content', {}).get('text', ''),
                    'score': result.get('score', 0),
                    'location': result.get('location', {})
                })
            
            return {
                'messageVersion': '1.0',
                'response': {
                    'actionGroup': action,
                    'apiPath': api_path,
                    'httpStatusCode': 200,
                    'responseBody': {
                        'application/json': {
                            'body': json.dumps({
                                'query': query,
                                'results': results,
                                'count': len(results)
                            })
                        }
                    }
                }
            }
        except Exception as e:
            return {
                'messageVersion': '1.0',
                'response': {
                    'actionGroup': action,
                    'apiPath': api_path,
                    'httpStatusCode': 500,
                    'responseBody': {
                        'application/json': {
                            'body': json.dumps({'error': str(e)})
                        }
                    }
                }
            }
    
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': action,
            'apiPath': api_path,
            'httpStatusCode': 400,
            'responseBody': {
                'application/json': {
                    'body': json.dumps({'error': 'Invalid request'})
                }
            }
        }
    }
      `),
    });

    retrievalLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:Retrieve'],
      resources: [knowledgeBase.attrKnowledgeBaseArn],
    }));

    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    agentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:Retrieve'],
      resources: ['*'],
    }));

    retrievalLambda.grantInvoke(agentRole);

    const agent = new bedrock.CfnAgent(this, 'RAGAgent', {
      agentName: 'rag-enhanced-agent',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: `You are a RAG-enhanced assistant with access to a knowledge base.
      When answering questions:
      1. First retrieve relevant documents from the knowledge base
      2. Synthesize information from multiple sources
      3. Cite your sources when providing answers
      4. If information is not in the knowledge base, say so clearly`,
    });

    new bedrock.CfnAgentKnowledgeBase(this, 'AgentKB', {
      agentId: agent.attrAgentId,
      agentVersion: 'DRAFT',
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      knowledgeBaseState: 'ENABLED',
    });

    const apiSchema = {
      openapi: '3.0.0',
      info: { title: 'RAG Retrieval API', version: '1.0.0' },
      paths: {
        '/retrieve-documents': {
          get: {
            summary: 'Retrieve relevant documents',
            operationId: 'retrieveDocuments',
            parameters: [
              { name: 'query', in: 'query', required: true, schema: { type: 'string' } },
              { name: 'maxResults', in: 'query', schema: { type: 'integer', default: 5 } },
            ],
            responses: { '200': { description: 'Retrieved documents' } },
          },
        },
      },
    };

    new bedrock.CfnAgentActionGroup(this, 'RetrievalActions', {
      agentId: agent.attrAgentId,
      agentVersion: 'DRAFT',
      actionGroupName: 'rag-retrieval',
      actionGroupExecutor: { lambda: retrievalLambda.functionArn },
      apiSchema: { payload: JSON.stringify(apiSchema) },
    });

    new cdk.CfnOutput(this, 'DocumentBucket', { value: documentBucket.bucketName });
    new cdk.CfnOutput(this, 'KnowledgeBaseId', { value: knowledgeBase.attrKnowledgeBaseId });
    new cdk.CfnOutput(this, 'AgentId', { value: agent.attrAgentId });
  }
}
