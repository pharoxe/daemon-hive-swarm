# Use when npm fails with: UNABLE_TO_VERIFY_LEAF_SIGNATURE (corporate proxy / TLS inspection).
# Prefer fixing trust: import your org root CA as PEM and run:
#   npm config set cafile C:\path\to\corp-root.pem
# This script only disables TLS verification for npm in this shell (not for Gradle/Java).

$env:NPM_CONFIG_STRICT_SSL = "false"
npm install @args
exit $LASTEXITCODE
