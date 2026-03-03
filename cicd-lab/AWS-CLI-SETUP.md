# AWS CLI Setup Guide

Before starting the lab, you need to configure the AWS CLI so it can authenticate with your AWS account.

## Option 1: Environment Variables (Recommended)

### Linux / macOS

Set these environment variables in your terminal:

```bash
export AWS_ACCESS_KEY_ID=<your-access-key-id>
export AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
export AWS_REGION=eu-west-1
```

To make them permanent, add them to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
echo 'export AWS_ACCESS_KEY_ID=<your-access-key-id>' >> ~/.bashrc
echo 'export AWS_SECRET_ACCESS_KEY=<your-secret-access-key>' >> ~/.bashrc
echo 'export AWS_REGION=eu-west-1' >> ~/.bashrc
source ~/.bashrc
```

### Windows PowerShell

Set environment variables for the current session:

```powershell
$env:AWS_ACCESS_KEY_ID="<your-access-key-id>"
$env:AWS_SECRET_ACCESS_KEY="<your-secret-access-key>"
$env:AWS_REGION="eu-west-1"
```

To make them permanent (user-level):

```powershell
[System.Environment]::SetEnvironmentVariable('AWS_ACCESS_KEY_ID', '<your-access-key-id>', 'User')
[System.Environment]::SetEnvironmentVariable('AWS_SECRET_ACCESS_KEY', '<your-secret-access-key>', 'User')
[System.Environment]::SetEnvironmentVariable('AWS_REGION', 'eu-west-1', 'User')
```

Then restart PowerShell.

### Windows Command Prompt (CMD)

Set environment variables for the current session:

```cmd
set AWS_ACCESS_KEY_ID=<your-access-key-id>
set AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
set AWS_REGION=eu-west-1
```

To make them permanent, use `setx`:

```cmd
setx AWS_ACCESS_KEY_ID "<your-access-key-id>"
setx AWS_SECRET_ACCESS_KEY "<your-secret-access-key>"
setx AWS_REGION "eu-west-1"
```

Then restart CMD.

### Verify (All Platforms)

```bash
aws sts get-caller-identity
```

You should see your AWS account ID and user ARN.

---

## Option 2: AWS CLI Configure

Run the AWS CLI configuration wizard:

```bash
aws configure
```

Enter your credentials when prompted:

```
AWS Access Key ID [None]: <your-access-key-id>
AWS Secret Access Key [None]: <your-secret-access-key>
Default region name [None]: eu-west-1
Default output format [None]: json
```

This stores credentials in `~/.aws/credentials` and config in `~/.aws/config`.

**Verify:**

```bash
aws sts get-caller-identity
```

---

## Option 3: Named Profiles

If you have multiple AWS accounts, use named profiles:

```bash
aws configure --profile my-lab-profile
```

Then use the profile with the `AWS_PROFILE` environment variable:

**Linux / macOS:**
```bash
export AWS_PROFILE=my-lab-profile
```

**Windows PowerShell:**
```powershell
$env:AWS_PROFILE="my-lab-profile"
```

**Windows CMD:**
```cmd
set AWS_PROFILE=my-lab-profile
```

Or use `--profile` flag with each command:

```bash
aws cloudformation deploy --stack-name cicd-lab --profile my-lab-profile ...
```

---

## Getting Your Access Keys

If you don't have access keys yet:

1. Log in to AWS Console
2. Go to **IAM** → **Users** → **Your Username**
3. Click **Security credentials** tab
4. Click **Create access key**
5. Choose **Command Line Interface (CLI)**
6. Download or copy the keys (you won't see the secret key again!)

---

## Required IAM Permissions

Your IAM user needs these policies attached:

- `AmazonEC2ContainerRegistryPowerUser` — Push Docker images to ECR
- `AmazonSSMFullAccess` — Deploy via Systems Manager
- `AmazonEC2ReadOnlyAccess` — Read EC2 instance info
- `CloudFormationFullAccess` — Deploy CloudFormation stacks
- `IAMFullAccess` — Create IAM roles (for CloudFormation)

Or create a custom policy with these permissions.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Unable to locate credentials` | Set environment variables or run `aws configure` |
| `Access Denied` | Check your IAM user has the required policies |
| `Region not set` | Set `AWS_REGION` or `AWS_DEFAULT_REGION` environment variable |
| `Invalid security token` | Your access keys may be expired or incorrect |
