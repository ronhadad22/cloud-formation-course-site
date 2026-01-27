# MGN Demo - Instructor Notes

## Demo Overview

This is a simplified AWS MGN demo designed for students with basic AWS knowledge.

**Duration:** 45 minutes (30 min demo + 15 min Q&A)  
**Difficulty:** Beginner  
**Prerequisites:** AWS CLI, EC2 key pair

---

## Pre-Demo Setup (Do This Before Class)

### 1. Test the Demo Yourself

Run through `STUDENT-DEMO.md` once to familiarize yourself with the flow.

### 2. Prepare Credentials

Each student (or group) needs:
- AWS account access
- AWS CLI configured
- EC2 key pair created

### 3. Set Expectations

Tell students:
- Demo costs < $1 if cleaned up properly
- Initial sync takes 10-20 minutes (good time for Q&A)
- They should follow along, not rush ahead

---

## Demo Flow

### Part 1: Introduction (5 min)

**Talking Points:**
- What is server migration?
- Why use MGN instead of manual migration?
- Real-world use cases (data center exit, disaster recovery, cloud migration)

**Show:**
- MGN architecture diagram (in README.md)
- AWS MGN console (empty state)

### Part 2: Setup (10 min)

**Live Demo:**
1. Initialize MGN service
2. Deploy CloudFormation stack
3. Explain what resources are created (VPC, subnets, security groups)

**Teaching Moment:**
- Show CloudFormation console
- Explain infrastructure as code
- Discuss why we need separate VPCs (source vs target)

### Part 3: Source Server & Agent (10 min)

**Live Demo:**
1. Deploy source server
2. Show web application in browser
3. SSH to server
4. Install MGN agent

**Teaching Moment:**
- Explain what the agent does (continuous replication)
- Discuss minimal performance impact
- Show agent logs: `sudo tail -f /var/log/aws-replication-agent.log`

### Part 4: Replication (15 min)

**While Waiting for Initial Sync:**

This is the perfect time for Q&A and deeper discussion!

**Topics to Cover:**
- How replication works (block-level vs file-level)
- What is "lag" and why it matters
- Replication server architecture
- Cost considerations

**Show:**
- MGN console with replication progress
- Run monitoring script: `./scripts/check-replication-status.sh`
- Explain replication states (INITIAL_SYNC → CONTINUOUS_SYNC)

**Interactive:**
- Ask students to create test files on source server
- Show how changes are replicated

### Part 5: Testing & Verification (5 min)

**Live Demo:**
1. Launch test instance from console
2. Access test instance web application
3. Compare source vs target

**Teaching Moment:**
- Explain why testing is critical
- Discuss rollback procedures
- Talk about cutover planning

---

## Common Student Questions

### "Why do we need MGN? Can't we just create an AMI?"

**Answer:** AMIs work for single servers, but MGN is better for:
- Continuous replication (minimal downtime)
- Large-scale migrations (hundreds of servers)
- Cross-cloud migrations (VMware, Azure, etc.)
- Automated conversion and testing

### "What happens to the source server after migration?"

**Answer:** Nothing automatically. You decide when to:
1. Keep it running (parallel operation)
2. Shut it down (after validation)
3. Decommission it (after cutover)

### "How much does MGN cost in production?"

**Answer:**
- First 90 days: FREE per source server
- After 90 days: ~$18/month per source server
- Plus infrastructure costs (replication servers, storage)
- No cost when not actively replicating

### "Can we migrate Windows servers?"

**Answer:** Yes! MGN supports:
- Linux (all major distributions)
- Windows Server (2008 R2 and later)
- Physical, virtual, and cloud servers

### "What if replication fails?"

**Answer:**
- Check network connectivity
- Verify security groups (port 443, 1500)
- Review agent logs
- MGN automatically retries
- No data loss - replication resumes from last checkpoint

---

## Troubleshooting During Demo

### Stack Creation Fails

**Likely Cause:** Region doesn't support MGN

**Solution:**
- Use us-east-1, us-west-2, or eu-central-1
- Check: https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/

### Agent Installation Fails

**Likely Cause:** Incorrect credentials or no internet access

**Solution:**
- Verify credentials are correct
- Check security group allows outbound HTTPS (443)
- Ensure source server has internet gateway route

### Replication Stalls

**Likely Cause:** Network issues or high change rate

**Solution:**
- Check source server connectivity
- Verify replication server is running
- Look for errors in agent logs

---

## Time Management Tips

### If Running Behind

**Skip:**
- Detailed CloudFormation explanation
- Creating test files on source
- Advanced troubleshooting discussion

**Focus On:**
- Agent installation (most important)
- Replication monitoring
- Test instance verification

### If Running Ahead

**Add:**
- Discuss cutover procedures
- Show launch template customization
- Explain post-migration optimization
- Demonstrate cleanup process

---

## Post-Demo

### Assignments

**Easy:**
- Write a 1-page summary of MGN benefits
- Document the migration steps

**Medium:**
- Migrate a different application
- Create a migration runbook

**Advanced:**
- Set up multi-server migration wave
- Implement automated testing

### Resources for Students

- AWS MGN Documentation: https://docs.aws.amazon.com/mgn/
- AWS MGN Workshops: https://catalog.workshops.aws/
- This repo: All materials in `docs/` and `labs/`

---

## Cleanup Reminder

**Critical:** Remind students to run cleanup!

```bash
./scripts/cleanup.sh
```

Or manually:
```bash
aws cloudformation delete-stack --stack-name mgn-source --region us-east-1
aws cloudformation delete-stack --stack-name mgn-demo --region us-east-1
```

**Check:** Have students verify stacks are deleted in console.

---

## Demo Variations

### For Advanced Students

- Use real on-premises VM (if available)
- Demonstrate wave-based migration
- Show post-migration optimization
- Discuss disaster recovery setup

### For Shorter Sessions (30 min)

- Pre-deploy source server
- Skip detailed CloudFormation explanation
- Focus on agent installation and replication
- Show pre-recorded test instance launch

### For Hands-On Workshop (2 hours)

- Students follow along individually
- Complete all 4 labs
- Include cutover procedure
- Add troubleshooting exercises

---

## Success Metrics

Students should be able to:
- ✅ Explain what MGN does
- ✅ Install MGN agent on a server
- ✅ Monitor replication status
- ✅ Launch a test instance
- ✅ Understand when to use MGN vs other migration methods

---

## Feedback

After the demo, ask students:
1. What was the most confusing part?
2. What would you like to learn more about?
3. Would you use MGN for your projects?

Use feedback to improve future demos!
