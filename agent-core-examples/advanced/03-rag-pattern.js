"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGPatternStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const opensearch = __importStar(require("aws-cdk-lib/aws-opensearchserverless"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
class RAGPatternStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        new cdk.CfnResource(this, 'AgentKB', {
            type: 'AWS::Bedrock::AgentKnowledgeBase',
            properties: {
                AgentId: agent.attrAgentId,
                AgentVersion: 'DRAFT',
                KnowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
                KnowledgeBaseState: 'ENABLED',
            },
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
        new cdk.CfnResource(this, 'RetrievalActions', {
            type: 'AWS::Bedrock::AgentActionGroup',
            properties: {
                AgentId: agent.attrAgentId,
                AgentVersion: 'DRAFT',
                ActionGroupName: 'rag-retrieval',
                ActionGroupExecutor: { Lambda: retrievalLambda.functionArn },
                ApiSchema: { Payload: JSON.stringify(apiSchema) },
            },
        });
        new cdk.CfnOutput(this, 'DocumentBucket', { value: documentBucket.bucketName });
        new cdk.CfnOutput(this, 'KnowledgeBaseId', { value: knowledgeBase.attrKnowledgeBaseId });
        new cdk.CfnOutput(this, 'AgentId', { value: agent.attrAgentId });
    }
}
exports.RAGPatternStack = RAGPatternStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDMtcmFnLXBhdHRlcm4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIwMy1yYWctcGF0dGVybi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQyx1REFBeUM7QUFDekMsaUZBQW1FO0FBQ25FLCtEQUFpRDtBQUdqRCxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLGNBQWMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELFVBQVUsRUFBRSxpQkFBaUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLFNBQVMsRUFBRSxJQUFJO1NBQ2hCLENBQUMsQ0FBQztRQUVILE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDckQsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDO1NBQzdELENBQUMsQ0FBQztRQUVILGNBQWMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFakMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDekMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsRUFBRSxtQkFBbUIsQ0FBQztZQUNyRCxTQUFTLEVB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RUFBRSxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDaEYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxFQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ25FLENBQUM7Q0FDRjtBQXRSRCwwQ0FzUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYmVkcm9jayBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYmVkcm9jayc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgb3BlbnNlYXJjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtb3BlbnNlYXJjaHNlcnZlcmxlc3MnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBSQUdQYXR0ZXJuU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBkb2N1bWVudEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0RvY3VtZW50QnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHJhZy1kb2N1bWVudHMtJHtjZGsuQXdzLkFDQ09VTlRfSUR9YCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGtiUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnS25vd2xlZGdlQmFzZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICBkb2N1bWVudEJ1Y2tldC5ncmFudFJlYWQoa2JSb2xlKTtcblxuICAgIGtiUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYW9zczpBUElBY2Nlc3NBbGwnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgY29uc3QgY29sbGVjdGlvbk5hbWUgPSAncmFnLWNvbGxlY3Rpb24nO1xuXG4gICAgY29uc3QgZW5jcnlwdGlvblBvbGljeSA9IG5ldyBvcGVuc2VhcmNoLkNmblNlY3VyaXR5UG9saWN5KHRoaXMsICdFbmNyeXB0aW9uUG9saWN5Jywge1xuICAgICAgbmFtZTogYCR7Y29sbGVjdGlvbk5hbWV9LWVuY2AsXG4gICAgICB0eXBlOiAnZW5jcnlwdGlvbicsXG4gICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgUnVsZXM6IFt7IFJlc291cmNlVHlwZTogJ2NvbGxlY3Rpb24nLCBSZXNvdXJjZTogW2Bjb2xsZWN0aW9uLyR7Y29sbGVjdGlvbk5hbWV9YF0gfV0sXG4gICAgICAgIEFXU093bmVkS2V5OiB0cnVlLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXR3b3JrUG9saWN5ID0gbmV3IG9wZW5zZWFyY2guQ2ZuU2VjdXJpdHlQb2xpY3kodGhpcywgJ05ldHdvcmtQb2xpY3knLCB7XG4gICAgICBuYW1lOiBgJHtjb2xsZWN0aW9uTmFtZX0tbmV0YCxcbiAgICAgIHR5cGU6ICduZXR3b3JrJyxcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoW1xuICAgICAgICB7XG4gICAgICAgICAgUnVsZXM6IFtcbiAgICAgICAgICAgIHsgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSB9LFxuICAgICAgICAgICAgeyBSZXNvdXJjZVR5cGU6ICdkYXNoYm9hcmQnLCBSZXNvdXJjZTogW2Bjb2xsZWN0aW9uLyR7Y29sbGVjdGlvbk5hbWV9YF0gfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIEFsbG93RnJvbVB1YmxpYzogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29sbGVjdGlvbiA9IG5ldyBvcGVuc2VhcmNoLkNmbkNvbGxlY3Rpb24odGhpcywgJ1JBR0NvbGxlY3Rpb24nLCB7XG4gICAgICBuYW1lOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgIHR5cGU6ICdWRUNUT1JTRUFSQ0gnLFxuICAgIH0pO1xuXG4gICAgY29sbGVjdGlvbi5hZGREZXBlbmRlbmN5KGVuY3J5cHRpb25Qb2xpY3kpO1xuICAgIGNvbGxlY3Rpb24uYWRkRGVwZW5kZW5jeShuZXR3b3JrUG9saWN5KTtcblxuICAgIGNvbnN0IGRhdGFBY2Nlc3NQb2xpY3kgPSBuZXcgb3BlbnNlYXJjaC5DZm5BY2Nlc3NQb2xpY3kodGhpcywgJ0RhdGFBY2Nlc3NQb2xpY3knLCB7XG4gICAgICBuYW1lOiBgJHtjb2xsZWN0aW9uTmFtZX0tYWNjZXNzYCxcbiAgICAgIHR5cGU6ICdkYXRhJyxcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoW1xuICAgICAgICB7XG4gICAgICAgICAgUnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsXG4gICAgICAgICAgICAgIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSxcbiAgICAgICAgICAgICAgUGVybWlzc2lvbjogWydhb3NzOkNyZWF0ZUNvbGxlY3Rpb25JdGVtcycsICdhb3NzOkRlbGV0ZUNvbGxlY3Rpb25JdGVtcycsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAnYW9zczpVcGRhdGVDb2xsZWN0aW9uSXRlbXMnLCAnYW9zczpEZXNjcmliZUNvbGxlY3Rpb25JdGVtcyddLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnaW5kZXgnLFxuICAgICAgICAgICAgICBSZXNvdXJjZTogW2BpbmRleC8ke2NvbGxlY3Rpb25OYW1lfS8qYF0sXG4gICAgICAgICAgICAgIFBlcm1pc3Npb246IFsnYW9zczpDcmVhdGVJbmRleCcsICdhb3NzOkRlbGV0ZUluZGV4JywgJ2Fvc3M6VXBkYXRlSW5kZXgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAnYW9zczpEZXNjcmliZUluZGV4JywgJ2Fvc3M6UmVhZERvY3VtZW50JywgJ2Fvc3M6V3JpdGVEb2N1bWVudCddLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIFByaW5jaXBhbDogW2tiUm9sZS5yb2xlQXJuXSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgIH0pO1xuXG4gICAgY29uc3Qga25vd2xlZGdlQmFzZSA9IG5ldyBiZWRyb2NrLkNmbktub3dsZWRnZUJhc2UodGhpcywgJ1JBR0tub3dsZWRnZUJhc2UnLCB7XG4gICAgICBuYW1lOiAncmFnLWtub3dsZWRnZS1iYXNlJyxcbiAgICAgIHJvbGVBcm46IGtiUm9sZS5yb2xlQXJuLFxuICAgICAga25vd2xlZGdlQmFzZUNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgdHlwZTogJ1ZFQ1RPUicsXG4gICAgICAgIHZlY3Rvcktub3dsZWRnZUJhc2VDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgZW1iZWRkaW5nTW9kZWxBcm46IGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuQXdzLlJFR0lPTn06OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjFgLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0b3JhZ2VDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIHR5cGU6ICdPUEVOU0VBUkNIX1NFUlZFUkxFU1MnLFxuICAgICAgICBvcGVuc2VhcmNoU2VydmVybGVzc0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBjb2xsZWN0aW9uQXJuOiBjb2xsZWN0aW9uLmF0dHJBcm4sXG4gICAgICAgICAgdmVjdG9ySW5kZXhOYW1lOiAncmFnLWluZGV4JyxcbiAgICAgICAgICBmaWVsZE1hcHBpbmc6IHtcbiAgICAgICAgICAgIHZlY3RvckZpZWxkOiAndmVjdG9yJyxcbiAgICAgICAgICAgIHRleHRGaWVsZDogJ3RleHQnLFxuICAgICAgICAgICAgbWV0YWRhdGFGaWVsZDogJ21ldGFkYXRhJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGtub3dsZWRnZUJhc2UuYWRkRGVwZW5kZW5jeShkYXRhQWNjZXNzUG9saWN5KTtcblxuICAgIG5ldyBiZWRyb2NrLkNmbkRhdGFTb3VyY2UodGhpcywgJ1MzRGF0YVNvdXJjZScsIHtcbiAgICAgIGtub3dsZWRnZUJhc2VJZDoga25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUlkLFxuICAgICAgbmFtZTogJ3MzLWRvY3VtZW50cycsXG4gICAgICBkYXRhU291cmNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICB0eXBlOiAnUzMnLFxuICAgICAgICBzM0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBidWNrZXRBcm46IGRvY3VtZW50QnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXRyaWV2YWxMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZXRyaWV2YWxIYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbmltcG9ydCBqc29uXG5pbXBvcnQgYm90bzNcblxuYmVkcm9ja19hZ2VudF9ydW50aW1lID0gYm90bzMuY2xpZW50KCdiZWRyb2NrLWFnZW50LXJ1bnRpbWUnKVxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgXCJcIlwiXG4gICAgRW5oYW5jZWQgcmV0cmlldmFsIHdpdGggY3VzdG9tIHByb2Nlc3NpbmdcbiAgICBcIlwiXCJcbiAgICBhY3Rpb24gPSBldmVudC5nZXQoJ2FjdGlvbkdyb3VwJylcbiAgICBhcGlfcGF0aCA9IGV2ZW50LmdldCgnYXBpUGF0aCcpXG4gICAgcGFyYW1ldGVycyA9IGV2ZW50LmdldCgncGFyYW1ldGVycycsIFtdKVxuICAgIFxuICAgIHF1ZXJ5ID0gbmV4dCgocFsndmFsdWUnXSBmb3IgcCBpbiBwYXJhbWV0ZXJzIGlmIHBbJ25hbWUnXSA9PSAncXVlcnknKSwgTm9uZSlcbiAgICBtYXhfcmVzdWx0cyA9IGludChuZXh0KChwWyd2YWx1ZSddIGZvciBwIGluIHBhcmFtZXRlcnMgaWYgcFsnbmFtZSddID09ICdtYXhSZXN1bHRzJyksICc1JykpXG4gICAgXG4gICAgaWYgYXBpX3BhdGggPT0gJy9yZXRyaWV2ZS1kb2N1bWVudHMnIGFuZCBxdWVyeTpcbiAgICAgICAgdHJ5OlxuICAgICAgICAgICAgcmVzcG9uc2UgPSBiZWRyb2NrX2FnZW50X3J1bnRpbWUucmV0cmlldmUoXG4gICAgICAgICAgICAgICAga25vd2xlZGdlQmFzZUlkPScke2tub3dsZWRnZUJhc2UuYXR0cktub3dsZWRnZUJhc2VJZH0nLFxuICAgICAgICAgICAgICAgIHJldHJpZXZhbFF1ZXJ5PXsndGV4dCc6IHF1ZXJ5fSxcbiAgICAgICAgICAgICAgICByZXRyaWV2YWxDb25maWd1cmF0aW9uPXtcbiAgICAgICAgICAgICAgICAgICAgJ3ZlY3RvclNlYXJjaENvbmZpZ3VyYXRpb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnbnVtYmVyT2ZSZXN1bHRzJzogbWF4X3Jlc3VsdHNcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmVzdWx0cyA9IFtdXG4gICAgICAgICAgICBmb3IgcmVzdWx0IGluIHJlc3BvbnNlLmdldCgncmV0cmlldmFsUmVzdWx0cycsIFtdKTpcbiAgICAgICAgICAgICAgICByZXN1bHRzLmFwcGVuZCh7XG4gICAgICAgICAgICAgICAgICAgICdjb250ZW50JzogcmVzdWx0LmdldCgnY29udGVudCcsIHt9KS5nZXQoJ3RleHQnLCAnJyksXG4gICAgICAgICAgICAgICAgICAgICdzY29yZSc6IHJlc3VsdC5nZXQoJ3Njb3JlJywgMCksXG4gICAgICAgICAgICAgICAgICAgICdsb2NhdGlvbic6IHJlc3VsdC5nZXQoJ2xvY2F0aW9uJywge30pXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAnbWVzc2FnZVZlcnNpb24nOiAnMS4wJyxcbiAgICAgICAgICAgICAgICAncmVzcG9uc2UnOiB7XG4gICAgICAgICAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgJ2FwaVBhdGgnOiBhcGlfcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgJ2h0dHBTdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAgICAgICAgICAgICAncmVzcG9uc2VCb2R5Jzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3F1ZXJ5JzogcXVlcnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdyZXN1bHRzJzogcmVzdWx0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NvdW50JzogbGVuKHJlc3VsdHMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAnbWVzc2FnZVZlcnNpb24nOiAnMS4wJyxcbiAgICAgICAgICAgICAgICAncmVzcG9uc2UnOiB7XG4gICAgICAgICAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgJ2FwaVBhdGgnOiBhcGlfcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgJ2h0dHBTdGF0dXNDb2RlJzogNTAwLFxuICAgICAgICAgICAgICAgICAgICAncmVzcG9uc2VCb2R5Jzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHsnZXJyb3InOiBzdHIoZSl9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgICdtZXNzYWdlVmVyc2lvbic6ICcxLjAnLFxuICAgICAgICAncmVzcG9uc2UnOiB7XG4gICAgICAgICAgICAnYWN0aW9uR3JvdXAnOiBhY3Rpb24sXG4gICAgICAgICAgICAnYXBpUGF0aCc6IGFwaV9wYXRoLFxuICAgICAgICAgICAgJ2h0dHBTdGF0dXNDb2RlJzogNDAwLFxuICAgICAgICAgICAgJ3Jlc3BvbnNlQm9keSc6IHtcbiAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHsnZXJyb3InOiAnSW52YWxpZCByZXF1ZXN0J30pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgICAgYCksXG4gICAgfSk7XG5cbiAgICByZXRyaWV2YWxMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpSZXRyaWV2ZSddLFxuICAgICAgcmVzb3VyY2VzOiBba25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUFybl0sXG4gICAgfSkpO1xuXG4gICAgY29uc3QgYWdlbnRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdBZ2VudFJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICBhZ2VudFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJywgJ2JlZHJvY2s6UmV0cmlldmUnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgcmV0cmlldmFsTGFtYmRhLmdyYW50SW52b2tlKGFnZW50Um9sZSk7XG5cbiAgICBjb25zdCBhZ2VudCA9IG5ldyBiZWRyb2NrLkNmbkFnZW50KHRoaXMsICdSQUdBZ2VudCcsIHtcbiAgICAgIGFnZW50TmFtZTogJ3JhZy1lbmhhbmNlZC1hZ2VudCcsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogYWdlbnRSb2xlLnJvbGVBcm4sXG4gICAgICBmb3VuZGF0aW9uTW9kZWw6ICdhbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjAnLFxuICAgICAgaW5zdHJ1Y3Rpb246IGBZb3UgYXJlIGEgUkFHLWVuaGFuY2VkIGFzc2lzdGFudCB3aXRoIGFjY2VzcyB0byBhIGtub3dsZWRnZSBiYXNlLlxuICAgICAgV2hlbiBhbnN3ZXJpbmcgcXVlc3Rpb25zOlxuICAgICAgMS4gRmlyc3QgcmV0cmlldmUgcmVsZXZhbnQgZG9jdW1lbnRzIGZyb20gdGhlIGtub3dsZWRnZSBiYXNlXG4gICAgICAyLiBTeW50aGVzaXplIGluZm9ybWF0aW9uIGZyb20gbXVsdGlwbGUgc291cmNlc1xuICAgICAgMy4gQ2l0ZSB5b3VyIHNvdXJjZXMgd2hlbiBwcm92aWRpbmcgYW5zd2Vyc1xuICAgICAgNC4gSWYgaW5mb3JtYXRpb24gaXMgbm90IGluIHRoZSBrbm93bGVkZ2UgYmFzZSwgc2F5IHNvIGNsZWFybHlgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5SZXNvdXJjZSh0aGlzLCAnQWdlbnRLQicsIHtcbiAgICAgIHR5cGU6ICdBV1M6OkJlZHJvY2s6OkFnZW50S25vd2xlZGdlQmFzZScsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIEFnZW50SWQ6IGFnZW50LmF0dHJBZ2VudElkLFxuICAgICAgICBBZ2VudFZlcnNpb246ICdEUkFGVCcsXG4gICAgICAgIEtub3dsZWRnZUJhc2VJZDoga25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUlkLFxuICAgICAgICBLbm93bGVkZ2VCYXNlU3RhdGU6ICdFTkFCTEVEJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlTY2hlbWEgPSB7XG4gICAgICBvcGVuYXBpOiAnMy4wLjAnLFxuICAgICAgaW5mbzogeyB0aXRsZTogJ1JBRyBSZXRyaWV2YWwgQVBJJywgdmVyc2lvbjogJzEuMC4wJyB9LFxuICAgICAgcGF0aHM6IHtcbiAgICAgICAgJy9yZXRyaWV2ZS1kb2N1bWVudHMnOiB7XG4gICAgICAgICAgZ2V0OiB7XG4gICAgICAgICAgICBzdW1tYXJ5OiAnUmV0cmlldmUgcmVsZXZhbnQgZG9jdW1lbnRzJyxcbiAgICAgICAgICAgIG9wZXJhdGlvbklkOiAncmV0cmlldmVEb2N1bWVudHMnLFxuICAgICAgICAgICAgcGFyYW1ldGVyczogW1xuICAgICAgICAgICAgICB7IG5hbWU6ICdxdWVyeScsIGluOiAncXVlcnknLCByZXF1aXJlZDogdHJ1ZSwgc2NoZW1hOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSxcbiAgICAgICAgICAgICAgeyBuYW1lOiAnbWF4UmVzdWx0cycsIGluOiAncXVlcnknLCBzY2hlbWE6IHsgdHlwZTogJ2ludGVnZXInLCBkZWZhdWx0OiA1IH0gfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNwb25zZXM6IHsgJzIwMCc6IHsgZGVzY3JpcHRpb246ICdSZXRyaWV2ZWQgZG9jdW1lbnRzJyB9IH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIG5ldyBjZGsuQ2ZuUmVzb3VyY2UodGhpcywgJ1JldHJpZXZhbEFjdGlvbnMnLCB7XG4gICAgICB0eXBlOiAnQVdTOjpCZWRyb2NrOjpBZ2VudEFjdGlvbkdyb3VwJyxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgQWdlbnRJZDogYWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICAgIEFnZW50VmVyc2lvbjogJ0RSQUZUJyxcbiAgICAgICAgQWN0aW9uR3JvdXBOYW1lOiAncmFnLXJldHJpZXZhbCcsXG4gICAgICAgIEFjdGlvbkdyb3VwRXhlY3V0b3I6IHsgTGFtYmRhOiByZXRyaWV2YWxMYW1iZGEuZnVuY3Rpb25Bcm4gfSxcbiAgICAgICAgQXBpU2NoZW1hOiB7IFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KGFwaVNjaGVtYSkgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRG9jdW1lbnRCdWNrZXQnLCB7IHZhbHVlOiBkb2N1bWVudEJ1Y2tldC5idWNrZXROYW1lIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdLbm93bGVkZ2VCYXNlSWQnLCB7IHZhbHVlOiBrbm93bGVkZ2VCYXNlLmF0dHJLbm93bGVkZ2VCYXNlSWQgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50SWQnLCB7IHZhbHVlOiBhZ2VudC5hdHRyQWdlbnRJZCB9KTtcbiAgfVxufVxuIl19