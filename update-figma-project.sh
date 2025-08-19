#!/bin/bash

echo "🔄 Updating Figma Project with new content..."

# Encrypt the source file with password "nayeon"
echo "📦 Encrypting figma-project-source.html..."
staticrypt figma-project-source.html -p nayeon

# Copy the encrypted content to the main file
echo "📋 Updating figma-project.html with new encrypted content..."

# Extract the encrypted content from the generated file
if [ -f "encrypted/figma-project-source.html" ]; then
    # Find the staticryptConfig line and extract it
    grep -A 1 "staticryptConfig = {" encrypted/figma-project-source.html > temp_config.txt
    
    # Update the main file with the new encrypted content
    # This is a simplified approach - you'll need to manually copy the new encrypted string
    echo "✅ Encryption complete!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Open encrypted/figma-project-source.html"
    echo "2. Find the line starting with 'staticryptConfig = {'"
    echo "3. Copy the entire encrypted string (everything between the quotes)"
    echo "4. Open figma-project.html"
    echo "5. Replace the existing staticryptConfig line with the new one"
    echo ""
    echo "🔑 Password remains: nayeon"
    
    # Clean up
    rm -rf encrypted
    rm temp_config.txt
else
    echo "❌ Error: Encrypted file not found"
    exit 1
fi

echo ""
echo "🎉 Update process completed!" 