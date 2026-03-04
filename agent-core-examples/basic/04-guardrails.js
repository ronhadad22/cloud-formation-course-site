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
exports.GuardrailsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class GuardrailsStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const guardrail = new bedrock.CfnGuardrail(this, 'AgentGuardrail', {
            name: 'agent-safety-guardrail',
            description: 'Guardrails to ensure safe agent interactions',
            blockedInputMessaging: 'I cannot process this request as it violates our content policy.',
            blockedOutputsMessaging: 'I cannot provide this response as it violates our content policy.',
            contentPolicyConfig: {
                filtersConfig: [
                    {
                        type: 'SEXUAL',
                        inputStrength: 'HIGH',
                        outputStrength: 'HIGH',
                    },
                    {
                        type: 'VIOLENCE',
                        inputStrength: 'HIGH',
                        outputStrength: 'HIGH',
                    },
                    {
                        type: 'HATE',
                        inputStrength: 'HIGH',
                        outputStrength: 'HIGH',
                    },
                    {
                        type: 'INSULTS',
                        inputStrength: 'MEDIUM',
                        outputStrength: 'MEDIUM',
                    },
                    {
                        type: 'MISCONDUCT',
                        inputStrength: 'MEDIUM',
                        outputStrength: 'MEDIUM',
                    },
                    {
                        type: 'PROMPT_ATTACK',
                        inputStrength: 'HIGH',
                        outputStrength: 'NONE',
                    },
                ],
            },
            topicPolicyConfig: {
                topicsConfig: [
                    {
                        name: 'financial-advice',
                        definition: 'Providing specific financial investment advice or recommendations',
                        examples: [
                            'Should I invest in this stock?',
                            'What cryptocurrency should I buy?',
                        ],
                        type: 'DENY',
                    },
                    {
                        name: 'medical-diagnosis',
                        definition: 'Providing medical diagnoses or treatment recommendations',
                        examples: [
                            'Do I have cancer?',
                            'What medication should I take?',
                        ],
                        type: 'DENY',
                    },
                ],
            },
            wordPolicyConfig: {
                wordsConfig: [
                    {
                        text: 'confidential',
                    },
                    {
                        text: 'secret',
                    },
                ],
                managedWordListsConfig: [
                    {
                        type: 'PROFANITY',
                    },
                ],
            },
            sensitiveInformationPolicyConfig: {
                piiEntitiesConfig: [
                    {
                        type: 'EMAIL',
                        action: 'ANONYMIZE',
                    },
                    {
                        type: 'PHONE',
                        action: 'ANONYMIZE',
                    },
                    {
                        type: 'CREDIT_DEBIT_CARD_NUMBER',
                        action: 'BLOCK',
                    },
                    {
                        type: 'US_SOCIAL_SECURITY_NUMBER',
                        action: 'BLOCK',
                    },
                ],
                regexesConfig: [
                    {
                        name: 'api-key-pattern',
                        description: 'Detect API keys',
                        pattern: '[A-Z0-9]{20,}',
                        action: 'BLOCK',
                    },
                ],
            },
        });
        const guardrailVersion = new bedrock.CfnGuardrailVersion(this, 'GuardrailVersion', {
            guardrailIdentifier: guardrail.attrGuardrailId,
        });
        const agentRole = new iam.Role(this, 'AgentRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        });
        agentRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel', 'bedrock:ApplyGuardrail'],
            resources: ['*'],
        }));
        const agent = new bedrock.CfnAgent(this, 'SafeAgent', {
            agentName: 'agent-with-guardrails',
            agentResourceRoleArn: agentRole.roleArn,
            foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
            instruction: 'You are a helpful assistant. Always prioritize user safety and follow all guardrails.',
            guardrailConfiguration: {
                guardrailIdentifier: guardrail.attrGuardrailId,
                guardrailVersion: guardrailVersion.attrVersion,
            },
        });
        new cdk.CfnOutput(this, 'GuardrailId', {
            value: guardrail.attrGuardrailId,
        });
        new cdk.CfnOutput(this, 'GuardrailVersion', {
            value: guardrailVersion.attrVersion,
        });
        new cdk.CfnOutput(this, 'AgentId', {
            value: agent.attrAgentId,
        });
    }
}
exports.GuardrailsStack = GuardrailsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDQtZ3VhcmRyYWlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIjA0LWd1YXJkcmFpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLGlFQUFtRDtBQUNuRCx5REFBMkM7QUFHM0MsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUNqRSxJQUFJLEVBQUUsd0JBQXdCO1lBQzlCLFdBQVcsRUFBRSw4Q0FBOEM7WUFDM0QscUJBQXFCLEVBQUUsa0VBQWtFO1lBQ3pGLHVCQUF1QixFQUFFLG1FQUFtRTtZQUU1RixtQkFBbUIsRUFBRTtnQkFDbkIsYUFBYSxFQUFFO29CQUNiO3dCQUNFLElBQUksRUFBRSxRQUFRO3dCQUNkLGFBQWEsRUFBRSxNQUFNO3dCQUNyQixjQUFjLEVBQUUsTUFBTTtxQkFDdkI7b0JBQ0Q7d0JBQ0UsSUFBSSxFQUFFLFVBQVU7d0JBQ2hCLGFBQWEsRUFBRSxNQUFNO3dCQUNyQixjQUFjLEVBQUUsTUFBTTtxQkFDdkI7b0JBQ0Q7d0JBQ0UsSUFBSSxFQUFFLE1BQU07d0JBQ1osYUFBYSxFQUFFLE1BQU07d0JBQ3JCLGNBQWMsRUFBRSxNQUFNO3FCQUN2QjtvQkFDRDt3QkFDRSxJQUFJLEVBQUUsU0FBUzt3QkFDZixhQUFhLEVBQUUsUUFBUTt3QkFDdkIsY0FBYyxFQUFFLFFBQVE7cUJBQ3pCO29CQUNEO3dCQUNFLElBQUksRUFBRSxZQUFZO3dCQUNsQixhQUFhLEVBQUUsUUFBUTt3QkFDdkIsY0FBYyxFQUFFLFFBQVE7cUJBQ3pCO29CQUNE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QUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxXQUFXO1NBQ3BDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ2pDLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVztTQUN6QixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF2SkQsMENBdUpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBHdWFyZHJhaWxzU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBndWFyZHJhaWwgPSBuZXcgYmVkcm9jay5DZm5HdWFyZHJhaWwodGhpcywgJ0FnZW50R3VhcmRyYWlsJywge1xuICAgICAgbmFtZTogJ2FnZW50LXNhZmV0eS1ndWFyZHJhaWwnLFxuICAgICAgZGVzY3JpcHRpb246ICdHdWFyZHJhaWxzIHRvIGVuc3VyZSBzYWZlIGFnZW50IGludGVyYWN0aW9ucycsXG4gICAgICBibG9ja2VkSW5wdXRNZXNzYWdpbmc6ICdJIGNhbm5vdCBwcm9jZXNzIHRoaXMgcmVxdWVzdCBhcyBpdCB2aW9sYXRlcyBvdXIgY29udGVudCBwb2xpY3kuJyxcbiAgICAgIGJsb2NrZWRPdXRwdXRzTWVzc2FnaW5nOiAnSSBjYW5ub3QgcHJvdmlkZSB0aGlzIHJlc3BvbnNlIGFzIGl0IHZpb2xhdGVzIG91ciBjb250ZW50IHBvbGljeS4nLFxuICAgICAgXG4gICAgICBjb250ZW50UG9saWN5Q29uZmlnOiB7XG4gICAgICAgIGZpbHRlcnNDb25maWc6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnU0VYVUFMJyxcbiAgICAgICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnVklPTEVOQ0UnLFxuICAgICAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdIQVRFJyxcbiAgICAgICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnSU5TVUxUUycsXG4gICAgICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnTUVESVVNJyxcbiAgICAgICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnTUVESVVNJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdNSVNDT05EVUNUJyxcbiAgICAgICAgICAgIGlucHV0U3RyZW5ndGg6ICdNRURJVU0nLFxuICAgICAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdNRURJVU0nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ1BST01QVF9BVFRBQ0snLFxuICAgICAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdOT05FJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcblxuICAgICAgdG9waWNQb2xpY3lDb25maWc6IHtcbiAgICAgICAgdG9waWNzQ29uZmlnOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2ZpbmFuY2lhbC1hZHZpY2UnLFxuICAgICAgICAgICAgZGVmaW5pdGlvbjogJ1Byb3ZpZGluZyBzcGVjaWZpYyBmaW5hbmNpYWwgaW52ZXN0bWVudCBhZHZpY2Ugb3IgcmVjb21tZW5kYXRpb25zJyxcbiAgICAgICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgICAgICdTaG91bGQgSSBpbnZlc3QgaW4gdGhpcyBzdG9jaz8nLFxuICAgICAgICAgICAgICAnV2hhdCBjcnlwdG9jdXJyZW5jeSBzaG91bGQgSSBidXk/JyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB0eXBlOiAnREVOWScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnbWVkaWNhbC1kaWFnbm9zaXMnLFxuICAgICAgICAgICAgZGVmaW5pdGlvbjogJ1Byb3ZpZGluZyBtZWRpY2FsIGRpYWdub3NlcyBvciB0cmVhdG1lbnQgcmVjb21tZW5kYXRpb25zJyxcbiAgICAgICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgICAgICdEbyBJIGhhdmUgY2FuY2VyPycsXG4gICAgICAgICAgICAgICdXaGF0IG1lZGljYXRpb24gc2hvdWxkIEkgdGFrZT8nLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHR5cGU6ICdERU5ZJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcblxuICAgICAgd29yZFBvbGljeUNvbmZpZzoge1xuICAgICAgICB3b3Jkc0NvbmZpZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6ICdjb25maWRlbnRpYWwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogJ3NlY3JldCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbWFuYWdlZFdvcmRMaXN0c0NvbmZpZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdQUk9GQU5JVFknLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuXG4gICAgICBzZW5zaXRpdmVJbmZvcm1hdGlvblBvbGljeUNvbmZpZzoge1xuICAgICAgICBwaWlFbnRpdGllc0NvbmZpZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdFTUFJTCcsXG4gICAgICAgICAgICBhY3Rpb246ICdBTk9OWU1JWkUnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ1BIT05FJyxcbiAgICAgICAgICAgIGFjdGlvbjogJ0FOT05ZTUlaRScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnQ1JFRElUX0RFQklUX0NBUkRfTlVNQkVSJyxcbiAgICAgICAgICAgIGFjdGlvbjogJ0JMT0NLJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdVU19TT0NJQUxfU0VDVVJJVFlfTlVNQkVSJyxcbiAgICAgICAgICAgIGFjdGlvbjogJ0JMT0NLJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICByZWdleGVzQ29uZmlnOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2FwaS1rZXktcGF0dGVybicsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RldGVjdCBBUEkga2V5cycsXG4gICAgICAgICAgICBwYXR0ZXJuOiAnW0EtWjAtOV17MjAsfScsXG4gICAgICAgICAgICBhY3Rpb246ICdCTE9DSycsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBndWFyZHJhaWxWZXJzaW9uID0gbmV3IGJlZHJvY2suQ2ZuR3VhcmRyYWlsVmVyc2lvbih0aGlzLCAnR3VhcmRyYWlsVmVyc2lvbicsIHtcbiAgICAgIGd1YXJkcmFpbElkZW50aWZpZXI6IGd1YXJkcmFpbC5hdHRyR3VhcmRyYWlsSWQsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhZ2VudFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FnZW50Um9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcbiAgICB9KTtcblxuICAgIGFnZW50Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYmVkcm9jazpBcHBseUd1YXJkcmFpbCddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICBjb25zdCBhZ2VudCA9IG5ldyBiZWRyb2NrLkNmbkFnZW50KHRoaXMsICdTYWZlQWdlbnQnLCB7XG4gICAgICBhZ2VudE5hbWU6ICdhZ2VudC13aXRoLWd1YXJkcmFpbHMnLFxuICAgICAgYWdlbnRSZXNvdXJjZVJvbGVBcm46IGFnZW50Um9sZS5yb2xlQXJuLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJyxcbiAgICAgIGluc3RydWN0aW9uOiAnWW91IGFyZSBhIGhlbHBmdWwgYXNzaXN0YW50LiBBbHdheXMgcHJpb3JpdGl6ZSB1c2VyIHNhZmV0eSBhbmQgZm9sbG93IGFsbCBndWFyZHJhaWxzLicsXG4gICAgICBndWFyZHJhaWxDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIGd1YXJkcmFpbElkZW50aWZpZXI6IGd1YXJkcmFpbC5hdHRyR3VhcmRyYWlsSWQsXG4gICAgICAgIGd1YXJkcmFpbFZlcnNpb246IGd1YXJkcmFpbFZlcnNpb24uYXR0clZlcnNpb24sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0d1YXJkcmFpbElkJywge1xuICAgICAgdmFsdWU6IGd1YXJkcmFpbC5hdHRyR3VhcmRyYWlsSWQsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR3VhcmRyYWlsVmVyc2lvbicsIHtcbiAgICAgIHZhbHVlOiBndWFyZHJhaWxWZXJzaW9uLmF0dHJWZXJzaW9uLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50SWQnLCB7XG4gICAgICB2YWx1ZTogYWdlbnQuYXR0ckFnZW50SWQsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==