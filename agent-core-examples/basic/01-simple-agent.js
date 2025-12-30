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
exports.SimpleAgentStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class SimpleAgentStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const agentRole = new iam.Role(this, 'AgentRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: 'Role for Bedrock Agent',
        });
        agentRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
            ],
            resources: ['*'],
        }));
        const agent = new bedrock.CfnAgent(this, 'MyFirstAgent', {
            agentName: 'simple-learning-agent',
            agentResourceRoleArn: agentRole.roleArn,
            foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
            instruction: `You are a helpful assistant that can answer questions about AWS services.
      Be concise and accurate in your responses.`,
            description: 'A simple agent for learning Agent Core concepts',
            idleSessionTtlInSeconds: 600,
        });
        new cdk.CfnOutput(this, 'AgentId', {
            value: agent.attrAgentId,
            description: 'The ID of the created agent',
        });
        new cdk.CfnOutput(this, 'AgentArn', {
            value: agent.attrAgentArn,
            description: 'The ARN of the created agent',
        });
    }
}
exports.SimpleAgentStack = SimpleAgentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDEtc2ltcGxlLWFnZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiMDEtc2ltcGxlLWFnZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxpRUFBbUQ7QUFDbkQseURBQTJDO0FBRzNDLE1BQWEsZ0JBQWlCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDN0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNoRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUM7WUFDNUQsV0FBVyxFQUFFLHdCQUF3QjtTQUN0QyxDQUFDLENBQUM7UUFFSCxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUM1QyxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7YUFDdEI7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7UUFFSixNQUFNLEtBQUssR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN2RCxTQUFTLEVBQUUsdUJBQXVCO1lBQ2xDLG9CQUFvQixFQUFFLFNBQVMsQ0FBQyxPQUFPO1lBQ3ZDLGVBQWUsRUFBRSx5Q0FBeUM7WUFDMUQsV0FBVyxFQUFFO2lEQUM4QjtZQUMzQyxXQUFXLEVBQUUsaURBQWlEO1lBQzlELHVCQUF1QixFQUFFLEdBQUc7U0FDN0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUU7WUFDakMsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXO1lBQ3hCLFdBQVcsRUFBRSw2QkFBNkI7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDbEMsS0FBSyxFQUFFLEtBQUssQ0FBQyxZQUFZO1lBQ3pCLFdBQVcsRUFBRSw4QkFBOEI7U0FDNUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBckNELDRDQXFDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgU2ltcGxlQWdlbnRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGFnZW50Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQWdlbnRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdSb2xlIGZvciBCZWRyb2NrIEFnZW50JyxcbiAgICB9KTtcblxuICAgIGFnZW50Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IGFnZW50ID0gbmV3IGJlZHJvY2suQ2ZuQWdlbnQodGhpcywgJ015Rmlyc3RBZ2VudCcsIHtcbiAgICAgIGFnZW50TmFtZTogJ3NpbXBsZS1sZWFybmluZy1hZ2VudCcsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogYWdlbnRSb2xlLnJvbGVBcm4sXG4gICAgICBmb3VuZGF0aW9uTW9kZWw6ICdhbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjAnLFxuICAgICAgaW5zdHJ1Y3Rpb246IGBZb3UgYXJlIGEgaGVscGZ1bCBhc3Npc3RhbnQgdGhhdCBjYW4gYW5zd2VyIHF1ZXN0aW9ucyBhYm91dCBBV1Mgc2VydmljZXMuXG4gICAgICBCZSBjb25jaXNlIGFuZCBhY2N1cmF0ZSBpbiB5b3VyIHJlc3BvbnNlcy5gLFxuICAgICAgZGVzY3JpcHRpb246ICdBIHNpbXBsZSBhZ2VudCBmb3IgbGVhcm5pbmcgQWdlbnQgQ29yZSBjb25jZXB0cycsXG4gICAgICBpZGxlU2Vzc2lvblR0bEluU2Vjb25kczogNjAwLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50SWQnLCB7XG4gICAgICB2YWx1ZTogYWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBJRCBvZiB0aGUgY3JlYXRlZCBhZ2VudCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRBcm4nLCB7XG4gICAgICB2YWx1ZTogYWdlbnQuYXR0ckFnZW50QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdUaGUgQVJOIG9mIHRoZSBjcmVhdGVkIGFnZW50JyxcbiAgICB9KTtcbiAgfVxufVxuIl19