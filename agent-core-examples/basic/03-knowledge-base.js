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
exports.KnowledgeBaseStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const opensearch = __importStar(require("aws-cdk-lib/aws-opensearchserverless"));
class KnowledgeBaseStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const dataBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
            bucketName: `agent-kb-data-${cdk.Aws.ACCOUNT_ID}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        const kbRole = new iam.Role(this, 'KnowledgeBaseRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        });
        dataBucket.grantRead(kbRole);
        kbRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
            ],
            resources: ['*'],
        }));
        kbRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'aoss:APIAccessAll',
            ],
            resources: ['*'],
        }));
        const collectionName = 'agent-kb-collection';
        const encryptionPolicy = new opensearch.CfnSecurityPolicy(this, 'EncryptionPolicy', {
            name: `${collectionName}-encryption`,
            type: 'encryption',
            policy: JSON.stringify({
                Rules: [
                    {
                        ResourceType: 'collection',
                        Resource: [`collection/${collectionName}`],
                    },
                ],
                AWSOwnedKey: true,
            }),
        });
        const networkPolicy = new opensearch.CfnSecurityPolicy(this, 'NetworkPolicy', {
            name: `${collectionName}-network`,
            type: 'network',
            policy: JSON.stringify([
                {
                    Rules: [
                        {
                            ResourceType: 'collection',
                            Resource: [`collection/${collectionName}`],
                        },
                        {
                            ResourceType: 'dashboard',
                            Resource: [`collection/${collectionName}`],
                        },
                    ],
                    AllowFromPublic: true,
                },
            ]),
        });
        const collection = new opensearch.CfnCollection(this, 'KnowledgeBaseCollection', {
            name: collectionName,
            type: 'VECTORSEARCH',
            description: 'Collection for Agent Knowledge Base',
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
                            Permission: [
                                'aoss:CreateCollectionItems',
                                'aoss:DeleteCollectionItems',
                                'aoss:UpdateCollectionItems',
                                'aoss:DescribeCollectionItems',
                            ],
                        },
                        {
                            ResourceType: 'index',
                            Resource: [`index/${collectionName}/*`],
                            Permission: [
                                'aoss:CreateIndex',
                                'aoss:DeleteIndex',
                                'aoss:UpdateIndex',
                                'aoss:DescribeIndex',
                                'aoss:ReadDocument',
                                'aoss:WriteDocument',
                            ],
                        },
                    ],
                    Principal: [kbRole.roleArn],
                },
            ]),
        });
        const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
            name: 'agent-learning-kb',
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
                    vectorIndexName: 'bedrock-knowledge-base-index',
                    fieldMapping: {
                        vectorField: 'vector',
                        textField: 'text',
                        metadataField: 'metadata',
                    },
                },
            },
        });
        knowledgeBase.addDependency(dataAccessPolicy);
        const dataSource = new bedrock.CfnDataSource(this, 'DataSource', {
            knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
            name: 's3-data-source',
            dataSourceConfiguration: {
                type: 'S3',
                s3Configuration: {
                    bucketArn: dataBucket.bucketArn,
                },
            },
        });
        const agentRole = new iam.Role(this, 'AgentRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        });
        agentRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel', 'bedrock:Retrieve'],
            resources: ['*'],
        }));
        const agent = new bedrock.CfnAgent(this, 'AgentWithKB', {
            agentName: 'agent-with-knowledge-base',
            agentResourceRoleArn: agentRole.roleArn,
            foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
            instruction: 'You are an assistant with access to a knowledge base. Use the knowledge base to answer questions accurately.',
        });
        new cdk.CfnResource(this, 'AgentKBAssociation', {
            type: 'AWS::Bedrock::AgentKnowledgeBase',
            properties: {
                AgentId: agent.attrAgentId,
                AgentVersion: 'DRAFT',
                KnowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
                Description: 'Knowledge base for the agent',
                KnowledgeBaseState: 'ENABLED',
            },
        });
        new cdk.CfnOutput(this, 'DataBucketName', {
            value: dataBucket.bucketName,
            description: 'Upload your documents here',
        });
        new cdk.CfnOutput(this, 'KnowledgeBaseId', {
            value: knowledgeBase.attrKnowledgeBaseId,
        });
        new cdk.CfnOutput(this, 'AgentId', {
            value: agent.attrAgentId,
        });
    }
}
exports.KnowledgeBaseStack = KnowledgeBaseStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDMta25vd2xlZGdlLWJhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIwMy1rbm93bGVkZ2UtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQyx1REFBeUM7QUFDekMsaUZBQW1FO0FBR25FLE1BQWEsa0JBQW1CLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzVELFVBQVUsRUFBRSxpQkFBaUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpQkFBaUIsRUFBRSxJQUFJO1NBQ3hCLENBQUMsQ0FBQztRQUVILE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDckQsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDO1NBQzdELENBQUMsQ0FBQztRQUVILFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFN0IsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDekMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1AscUJBQXFCO2FBQ3RCO1lBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FBQyxDQUFD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b250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBvcGVuc2VhcmNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1vcGVuc2VhcmNoc2VydmVybGVzcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIEtub3dsZWRnZUJhc2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGRhdGFCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdLbm93bGVkZ2VCYXNlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGFnZW50LWtiLWRhdGEtJHtjZGsuQXdzLkFDQ09VTlRfSUR9YCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGtiUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnS25vd2xlZGdlQmFzZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICBkYXRhQnVja2V0LmdyYW50UmVhZChrYlJvbGUpO1xuXG4gICAga2JSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAga2JSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2Fvc3M6QVBJQWNjZXNzQWxsJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IGNvbGxlY3Rpb25OYW1lID0gJ2FnZW50LWtiLWNvbGxlY3Rpb24nO1xuXG4gICAgY29uc3QgZW5jcnlwdGlvblBvbGljeSA9IG5ldyBvcGVuc2VhcmNoLkNmblNlY3VyaXR5UG9saWN5KHRoaXMsICdFbmNyeXB0aW9uUG9saWN5Jywge1xuICAgICAgbmFtZTogYCR7Y29sbGVjdGlvbk5hbWV9LWVuY3J5cHRpb25gLFxuICAgICAgdHlwZTogJ2VuY3J5cHRpb24nLFxuICAgICAgcG9saWN5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIFJ1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsXG4gICAgICAgICAgICBSZXNvdXJjZTogW2Bjb2xsZWN0aW9uLyR7Y29sbGVjdGlvbk5hbWV9YF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgQVdTT3duZWRLZXk6IHRydWUsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ldHdvcmtQb2xpY3kgPSBuZXcgb3BlbnNlYXJjaC5DZm5TZWN1cml0eVBvbGljeSh0aGlzLCAnTmV0d29ya1BvbGljeScsIHtcbiAgICAgIG5hbWU6IGAke2NvbGxlY3Rpb25OYW1lfS1uZXR3b3JrYCxcbiAgICAgIHR5cGU6ICduZXR3b3JrJyxcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoW1xuICAgICAgICB7XG4gICAgICAgICAgUnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsXG4gICAgICAgICAgICAgIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIFJlc291cmNlVHlwZTogJ2Rhc2hib2FyZCcsXG4gICAgICAgICAgICAgIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICBBbGxvd0Zyb21QdWJsaWM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICBdKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgb3BlbnNlYXJjaC5DZm5Db2xsZWN0aW9uKHRoaXMsICdLbm93bGVkZ2VCYXNlQ29sbGVjdGlvbicsIHtcbiAgICAgIG5hbWU6IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgdHlwZTogJ1ZFQ1RPUlNFQVJDSCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbGxlY3Rpb24gZm9yIEFnZW50IEtub3dsZWRnZSBCYXNlJyxcbiAgICB9KTtcblxuICAgIGNvbGxlY3Rpb24uYWRkRGVwZW5kZW5jeShlbmNyeXB0aW9uUG9saWN5KTtcbiAgICBjb2xsZWN0aW9uLmFkZERlcGVuZGVuY3kobmV0d29ya1BvbGljeSk7XG5cbiAgICBjb25zdCBkYXRhQWNjZXNzUG9saWN5ID0gbmV3IG9wZW5zZWFyY2guQ2ZuQWNjZXNzUG9saWN5KHRoaXMsICdEYXRhQWNjZXNzUG9saWN5Jywge1xuICAgICAgbmFtZTogYCR7Y29sbGVjdGlvbk5hbWV9LWFjY2Vzc2AsXG4gICAgICB0eXBlOiAnZGF0YScsXG4gICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KFtcbiAgICAgICAge1xuICAgICAgICAgIFJ1bGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIFJlc291cmNlVHlwZTogJ2NvbGxlY3Rpb24nLFxuICAgICAgICAgICAgICBSZXNvdXJjZTogW2Bjb2xsZWN0aW9uLyR7Y29sbGVjdGlvbk5hbWV9YF0sXG4gICAgICAgICAgICAgIFBlcm1pc3Npb246IFtcbiAgICAgICAgICAgICAgICAnYW9zczpDcmVhdGVDb2xsZWN0aW9uSXRlbXMnLFxuICAgICAgICAgICAgICAgICdhb3NzOkRlbGV0ZUNvbGxlY3Rpb25JdGVtcycsXG4gICAgICAgICAgICAgICAgJ2Fvc3M6VXBkYXRlQ29sbGVjdGlvbkl0ZW1zJyxcbiAgICAgICAgICAgICAgICAnYW9zczpEZXNjcmliZUNvbGxlY3Rpb25JdGVtcycsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBSZXNvdXJjZVR5cGU6ICdpbmRleCcsXG4gICAgICAgICAgICAgIFJlc291cmNlOiBbYGluZGV4LyR7Y29sbGVjdGlvbk5hbWV9LypgXSxcbiAgICAgICAgICAgICAgUGVybWlzc2lvbjogW1xuICAgICAgICAgICAgICAgICdhb3NzOkNyZWF0ZUluZGV4JyxcbiAgICAgICAgICAgICAgICAnYW9zczpEZWxldGVJbmRleCcsXG4gICAgICAgICAgICAgICAgJ2Fvc3M6VXBkYXRlSW5kZXgnLFxuICAgICAgICAgICAgICAgICdhb3NzOkRlc2NyaWJlSW5kZXgnLFxuICAgICAgICAgICAgICAgICdhb3NzOlJlYWREb2N1bWVudCcsXG4gICAgICAgICAgICAgICAgJ2Fvc3M6V3JpdGVEb2N1bWVudCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgUHJpbmNpcGFsOiBba2JSb2xlLnJvbGVBcm5dLFxuICAgICAgICB9LFxuICAgICAgXSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBrbm93bGVkZ2VCYXNlID0gbmV3IGJlZHJvY2suQ2ZuS25vd2xlZGdlQmFzZSh0aGlzLCAnS25vd2xlZGdlQmFzZScsIHtcbiAgICAgIG5hbWU6ICdhZ2VudC1sZWFybmluZy1rYicsXG4gICAgICByb2xlQXJuOiBrYlJvbGUucm9sZUFybixcbiAgICAgIGtub3dsZWRnZUJhc2VDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIHR5cGU6ICdWRUNUT1InLFxuICAgICAgICB2ZWN0b3JLbm93bGVkZ2VCYXNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgIGVtYmVkZGluZ01vZGVsQXJuOiBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLkF3cy5SRUdJT059Ojpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYxYCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzdG9yYWdlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICB0eXBlOiAnT1BFTlNFQVJDSF9TRVJWRVJMRVNTJyxcbiAgICAgICAgb3BlbnNlYXJjaFNlcnZlcmxlc3NDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgY29sbGVjdGlvbkFybjogY29sbGVjdGlvbi5hdHRyQXJuLFxuICAgICAgICAgIHZlY3RvckluZGV4TmFtZTogJ2JlZHJvY2sta25vd2xlZGdlLWJhc2UtaW5kZXgnLFxuICAgICAgICAgIGZpZWxkTWFwcGluZzoge1xuICAgICAgICAgICAgdmVjdG9yRmllbGQ6ICd2ZWN0b3InLFxuICAgICAgICAgICAgdGV4dEZpZWxkOiAndGV4dCcsXG4gICAgICAgICAgICBtZXRhZGF0YUZpZWxkOiAnbWV0YWRhdGEnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAga25vd2xlZGdlQmFzZS5hZGREZXBlbmRlbmN5KGRhdGFBY2Nlc3NQb2xpY3kpO1xuXG4gICAgY29uc3QgZGF0YVNvdXJjZSA9IG5ldyBiZWRyb2NrLkNmbkRhdGFTb3VyY2UodGhpcywgJ0RhdGFTb3VyY2UnLCB7XG4gICAgICBrbm93bGVkZ2VCYXNlSWQ6IGtub3dsZWRnZUJhc2UuYXR0cktub3dsZWRnZUJhc2VJZCxcbiAgICAgIG5hbWU6ICdzMy1kYXRhLXNvdXJjZScsXG4gICAgICBkYXRhU291cmNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICB0eXBlOiAnUzMnLFxuICAgICAgICBzM0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBidWNrZXRBcm46IGRhdGFCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFnZW50Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQWdlbnRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgYWdlbnRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCcsICdiZWRyb2NrOlJldHJpZXZlJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IGFnZW50ID0gbmV3IGJlZHJvY2suQ2ZuQWdlbnQodGhpcywgJ0FnZW50V2l0aEtCJywge1xuICAgICAgYWdlbnROYW1lOiAnYWdlbnQtd2l0aC1rbm93bGVkZ2UtYmFzZScsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogYWdlbnRSb2xlLnJvbGVBcm4sXG4gICAgICBmb3VuZGF0aW9uTW9kZWw6ICdhbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjAnLFxuICAgICAgaW5zdHJ1Y3Rpb246ICdZb3UgYXJlIGFuIGFzc2lzdGFudCB3aXRoIGFjY2VzcyB0byBhIGtub3dsZWRnZSBiYXNlLiBVc2UgdGhlIGtub3dsZWRnZSBiYXNlIHRvIGFuc3dlciBxdWVzdGlvbnMgYWNjdXJhdGVseS4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5SZXNvdXJjZSh0aGlzLCAnQWdlbnRLQkFzc29jaWF0aW9uJywge1xuICAgICAgdHlwZTogJ0FXUzo6QmVkcm9jazo6QWdlbnRLbm93bGVkZ2VCYXNlJyxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgQWdlbnRJZDogYWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICAgIEFnZW50VmVyc2lvbjogJ0RSQUZUJyxcbiAgICAgICAgS25vd2xlZGdlQmFzZUlkOiBrbm93bGVkZ2VCYXNlLmF0dHJLbm93bGVkZ2VCYXNlSWQsXG4gICAgICAgIERlc2NyaXB0aW9uOiAnS25vd2xlZGdlIGJhc2UgZm9yIHRoZSBhZ2VudCcsXG4gICAgICAgIEtub3dsZWRnZUJhc2VTdGF0ZTogJ0VOQUJMRUQnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXRhQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBkYXRhQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VwbG9hZCB5b3VyIGRvY3VtZW50cyBoZXJlJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdLbm93bGVkZ2VCYXNlSWQnLCB7XG4gICAgICB2YWx1ZToga25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUlkLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50SWQnLCB7XG4gICAgICB2YWx1ZTogYWdlbnQuYXR0ckFnZW50SWQsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==