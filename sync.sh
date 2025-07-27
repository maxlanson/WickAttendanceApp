#!/bin/bash
# Safe Local Sync Script
# Usage: ./sync.sh "commit message"

set -e

echo "🔄 Starting safe local sync..."

# Check if there are changes
if [ -z "$(git status --porcelain)" ]; then
    echo "📝 No changes to commit"
    exit 0
fi

# Get commit message
if [ -z "$1" ]; then
    echo "📝 Please provide a commit message:"
    read -r commit_message
else
    commit_message="$1"
fi

# Show what will be committed
echo "📋 Files to be committed:"
git status --short

echo ""
echo "💾 Committing changes..."
git add .
git commit -m "$commit_message"

echo ""
echo "✅ Local sync complete!"
echo "🔍 Recent commits:"
git log --oneline -3

echo ""
echo "🚀 Ready to push? Run: git push origin main"
echo "📂 Or continue editing in VS Code!"
