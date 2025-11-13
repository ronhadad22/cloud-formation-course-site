# Jenkins Configuration as Code (JCasC) Setup

This directory contains everything needed to deploy Jenkins from scratch with full configuration using Jenkins Configuration as Code (JCasC).

## 🚀 Quick Start

### One-Command Deployment
```bash
chmod +x deploy-jenkins-from-scratch.sh
./deploy-jenkins-from-scratch.sh
```

This script will:
1. ✅ Configure kubectl for your EKS cluster
2. ✅ Create the required storage class
3. ✅ Setup IRSA for ECR access
4. ✅ Deploy Jenkins with full JCasC configuration
5. ✅ Provide access credentials

## 📁 Files Overview

| File | Purpose |
|------|---------|
| `jenkins-values-casc.yaml` | Helm values with embedded JCasC config |
| `jenkins-casc-complete.yaml` | Standalone JCasC configuration |
| `deploy-jenkins-from-scratch.sh` | Complete deployment script |
| `sc.yaml` | Storage class for standard EKS |
| `irsa-jenkins/` | IRSA setup for ECR access |

## 🔧 What Gets Configured Automatically

### **Jenkins Core**
- ✅ Admin user with secure authentication
- ✅ Security realm and authorization
- ✅ CSRF protection enabled
- ✅ Essential security settings

### **Kubernetes Cloud**
- ✅ Dynamic agent provisioning
- ✅ Two agent templates:
  - **Default JNLP agent**: Basic builds
  - **Docker + ECR agent**: Container builds with ECR push

### **Pre-installed Plugins**
- ✅ Kubernetes integration
- ✅ Docker workflow
- ✅ Amazon ECR support
- ✅ Pipeline and Blue Ocean
- ✅ Git and GitHub integration
- ✅ Job DSL for job creation
- ✅ Essential build tools

### **Sample Jobs**
- ✅ **ecr-build-sample**: Ready-to-use ECR build pipeline
- ✅ Demonstrates Docker build and ECR push
- ✅ Uses IRSA for automatic authentication

### **ECR Integration**
- ✅ IRSA service account for secure ECR access
- ✅ No hardcoded credentials needed
- ✅ Automatic ECR login in pipelines
- ✅ Multi-region support

## 🎯 Usage Examples

### **Basic ECR Pipeline**
```groovy
pipeline {
    agent { label 'docker ecr' }
    environment {
        ECR_REGISTRY = "950555670656.dkr.ecr.us-east-1.amazonaws.com"
        IMAGE_REPO = "my-app"
        IMAGE_TAG = "${BUILD_NUMBER}"
        AWS_DEFAULT_REGION = "us-east-1"
    }
    stages {
        stage('Build & Push') {
            steps {
                container('aws-cli') {
                    sh 'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY'
                }
                container('docker') {
                    sh '''
                        docker build -t ${IMAGE_REPO}:${IMAGE_TAG} .
                        docker tag ${IMAGE_REPO}:${IMAGE_TAG} ${ECR_REGISTRY}/${IMAGE_REPO}:${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${IMAGE_REPO}:${IMAGE_TAG}
                    '''
                }
            }
        }
    }
}
```

### **Multi-branch Pipeline**
The configuration supports automatic multi-branch pipeline creation for GitHub repositories.

## 🔄 Updating Configuration

### **Method 1: Update JCasC and Redeploy**
1. Edit `jenkins-values-casc.yaml`
2. Run: `helm upgrade jenkins jenkinsci/jenkins -n jenkins -f jenkins-values-casc.yaml`
3. Jenkins will automatically reload the configuration

### **Method 2: Live Configuration Reload**
1. Access Jenkins UI
2. Go to **Manage Jenkins** → **Configuration as Code**
3. Make changes and click **Apply new configuration**

## 🛠 Customization

### **Adding New Agent Templates**
Edit the `templates` section in `jenkins-values-casc.yaml`:

```yaml
- containers:
  - name: "my-custom-agent"
    image: "my-custom-image:latest"
    # ... configuration
  label: "my-label"
  name: "my-template"
  serviceAccount: "jenkins-agent"  # For ECR access
```

### **Adding New Jobs**
Add to the `jobs` section:

```yaml
jobs:
  - script: |
      pipelineJob('my-new-job') {
        definition {
          cps {
            script('''
              // Your pipeline script here
            ''')
          }
        }
      }
```

### **Configuring Credentials**
Add to the JCasC configuration:

```yaml
credentials:
  system:
    domainCredentials:
    - credentials:
      - usernamePassword:
          scope: GLOBAL
          id: "my-creds"
          username: "myuser"
          password: "mypass"
```

## 🔍 Troubleshooting

### **Jenkins Pod Not Starting**
```bash
kubectl describe pod jenkins-0 -n jenkins
kubectl logs jenkins-0 -n jenkins -c jenkins
```

### **IRSA Not Working**
```bash
kubectl describe serviceaccount jenkins-agent -n jenkins
aws iam get-role --role-name JenkinsECRRole --profile int-profile
```

### **Agent Pods Failing**
```bash
kubectl get pods -n jenkins -l jenkins=agent
kubectl describe pod <agent-pod-name> -n jenkins
```

### **Configuration Issues**
1. Check JCasC syntax in Jenkins UI
2. Go to **Manage Jenkins** → **Configuration as Code**
3. View configuration and check for errors

## 📊 Benefits of This Approach

### **Reproducibility**
- ✅ Identical Jenkins setup every time
- ✅ Version controlled configuration
- ✅ Easy to replicate across environments

### **Security**
- ✅ No manual credential management
- ✅ IRSA for secure AWS access
- ✅ Proper RBAC configuration

### **Efficiency**
- ✅ Zero manual configuration needed
- ✅ Ready-to-use pipelines included
- ✅ Automatic plugin installation

### **Maintainability**
- ✅ Configuration as code
- ✅ Easy updates and rollbacks
- ✅ Clear documentation

## 🔗 References

- [Jenkins Configuration as Code](https://jenkins.io/projects/jcasc/)
- [Jenkins Kubernetes Plugin](https://plugins.jenkins.io/kubernetes/)
- [AWS IAM Roles for Service Accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
- [Amazon ECR User Guide](https://docs.aws.amazon.com/ecr/)

---

**Ready to deploy?** Run `./deploy-jenkins-from-scratch.sh` and you'll have a fully configured Jenkins instance in minutes! 🚀
