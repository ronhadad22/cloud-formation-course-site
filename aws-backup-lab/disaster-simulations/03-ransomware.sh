#!/bin/bash
###############################################################################
# Disaster Scenario 3: Ransomware Simulation
# Simulates ransomware encrypting files on EFS and leaving ransom notes
#
# SAFE: Only renames files (does not actually encrypt). Supports rollback.
# FOR TRAINING AND SIMULATION ONLY.
###############################################################################

set -e

EC2_IP=${1:?"Usage: ./03-ransomware.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>"}
KEY_PATH=${2:?"Usage: ./03-ransomware.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>"}
LOG_FILE="disaster-logs/ransomware-$(date +%Y%m%d_%H%M%S).log"

mkdir -p disaster-logs

echo "============================================" | tee -a "$LOG_FILE"
echo "💥 DISASTER SCENARIO 3: Ransomware Attack"  | tee -a "$LOG_FILE"
echo "   File Encryption Simulation"               | tee -a "$LOG_FILE"
echo "   Time: $(date)"                            | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "📋 SCENARIO: Ransomware has infiltrated the system via a" | tee -a "$LOG_FILE"
echo "   phishing email. It is 'encrypting' files on EFS and"   | tee -a "$LOG_FILE"
echo "   dropping ransom notes in each directory."               | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

ssh -i "$KEY_PATH" ec2-user@${EC2_IP} << 'REMOTEOF'
echo "📊 BEFORE ATTACK - EFS State:"
echo "  Total files: $(find /mnt/efs/hospital-data -type f 2>/dev/null | wc -l)"
echo "  Total size:  $(du -sh /mnt/efs/hospital-data/ 2>/dev/null | awk '{print $1}')"
echo ""

# Safety: Create backup of file listing for rollback
find /mnt/efs/hospital-data -type f > /tmp/ransomware-original-files.txt
echo "🔒 Original file listing saved to /tmp/ransomware-original-files.txt"
echo ""

echo "💥 RANSOMWARE EXECUTING..."
echo ""

# Simulate "encryption" by renaming files to .encrypted
ENCRYPTED_COUNT=0
for dir in patients configs billing logs; do
    TARGET="/mnt/efs/hospital-data/$dir"
    if [ -d "$TARGET" ]; then
        for file in $(find "$TARGET" -type f ! -name "*.encrypted" ! -name "RANSOM_NOTE.txt" 2>/dev/null); do
            sudo mv "$file" "${file}.encrypted" 2>/dev/null && ENCRYPTED_COUNT=$((ENCRYPTED_COUNT + 1))
        done
        echo "  🔒 Encrypted files in $dir/"
    fi
done

# Drop ransom notes in each directory
RANSOM_NOTE='
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║              YOUR FILES HAVE BEEN ENCRYPTED              ║
║                                                          ║
║  All your hospital data has been encrypted with          ║
║  military-grade encryption.                              ║
║                                                          ║
║  To recover your files, send 5 BTC to:                   ║
║  bc1q_FAKE_ADDRESS_FOR_TRAINING_ONLY                     ║
║                                                          ║
║  ⚠️  THIS IS A SIMULATION FOR TRAINING PURPOSES ⚠️       ║
║  No actual encryption occurred. Files were renamed.      ║
║                                                          ║
║  Time remaining: 48:00:00                                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
'

for dir in patients configs billing logs medical-images; do
    TARGET="/mnt/efs/hospital-data/$dir"
    if [ -d "$TARGET" ]; then
        echo "$RANSOM_NOTE" | sudo tee "$TARGET/RANSOM_NOTE.txt" > /dev/null
    fi
done

# Drop a ransom note on the web server too
sudo bash -c 'cat > /var/www/html/index.html << HTMLEOF
<html>
<body style="background:#000;color:#ff0000;text-align:center;font-family:monospace;padding:50px">
<h1>⚠️ YOUR SYSTEM HAS BEEN COMPROMISED ⚠️</h1>
<pre style="color:#ff0000;font-size:14px">
All hospital data has been encrypted.
Patient records, medical images, and billing data are inaccessible.

To recover your data, send 5 BTC to: bc1q_FAKE_ADDRESS

Time remaining: <span id="timer">48:00:00</span>

╔═══════════════════════════════════════════╗
║  THIS IS A TRAINING SIMULATION            ║
║  No real encryption occurred              ║
║  Restore from AWS Backup to recover       ║
╚═══════════════════════════════════════════╝
</pre>
</body>
<script>
let t=48*3600;setInterval(()=>{t--;let h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;
document.getElementById("timer").textContent=h+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")},1000);
</script>
</html>
HTMLEOF'

echo ""
echo "📊 AFTER ATTACK:"
echo "  Files 'encrypted': $ENCRYPTED_COUNT"
echo "  Ransom notes dropped: $(find /mnt/efs/hospital-data -name 'RANSOM_NOTE.txt' | wc -l)"
echo "  .encrypted files: $(find /mnt/efs/hospital-data -name '*.encrypted' | wc -l)"
echo "  Web server: DEFACED"

echo ""
echo "============================================"
echo "🚨 RANSOMWARE ATTACK COMPLETE"
echo "   Files renamed to .encrypted"
echo "   Ransom notes in every directory"
echo "   Web server defaced"
echo "   Your mission: Restore from air-gapped backup vault"
echo "============================================"
echo ""
echo "💡 ROLLBACK AVAILABLE: If needed, run on EC2:"
echo "   # Rename files back:"
echo "   find /mnt/efs/hospital-data -name '*.encrypted' | while read f; do sudo mv \"\$f\" \"\${f%.encrypted}\"; done"
echo "   # Remove ransom notes:"
echo "   find /mnt/efs/hospital-data -name 'RANSOM_NOTE.txt' -delete"
REMOTEOF

echo "" | tee -a "$LOG_FILE"
echo "Disaster executed at $(date)" >> "$LOG_FILE"
echo "✅ Disaster simulation complete. Check $LOG_FILE for details."
