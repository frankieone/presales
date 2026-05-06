#!/bin/bash
#
# Download all document attachments (selfies, ID photos) for a FrankieOne entity.
# Uses the V2 API: GET /v2/individuals/{entityId}/documents
#
# Requirements: curl, jq, base64
#
# Usage:
#   export FRANKIE_API_KEY="your-api-key"
#   export FRANKIE_CUSTOMER_ID="your-customer-id"
#   ./download-entity-attachments.sh <entityId> [base-url]

set -euo pipefail

ENTITY_ID="${1:?Usage: $0 <entityId> [base-url]}"
BASE_URL="${2:-https://api.frankieone.com}"

if [ -z "${FRANKIE_API_KEY:-}" ]; then
  echo "Error: FRANKIE_API_KEY environment variable is not set"
  exit 1
fi

if [ -z "${FRANKIE_CUSTOMER_ID:-}" ]; then
  echo "Error: FRANKIE_CUSTOMER_ID environment variable is not set"
  exit 1
fi

OUTPUT_DIR="entity-attachments/${ENTITY_ID}"
mkdir -p "$OUTPUT_DIR"

echo "Fetching documents for entity: $ENTITY_ID"
echo "API: $BASE_URL/v2/individuals/$ENTITY_ID/documents"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "api_key: ${FRANKIE_API_KEY}" \
  -H "X-Frankie-CustomerID: ${FRANKIE_CUSTOMER_ID}" \
  "${BASE_URL}/v2/individuals/${ENTITY_ID}/documents")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "Error: API returned HTTP $HTTP_CODE"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi

echo "$BODY" | jq . > "$OUTPUT_DIR/response.json"
echo "Full API response saved to $OUTPUT_DIR/response.json"
echo ""

# Process each document category (IDENTITY, SUPPORTING, REPORT, OTHER)
CATEGORIES=$(echo "$BODY" | jq -r 'keys[]')
TOTAL=0

for CATEGORY in $CATEGORIES; do
  DOC_COUNT=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"] | length")

  for ((i=0; i<DOC_COUNT; i++)); do
    DOC_TYPE=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"][$i].type // \"unknown\"")
    DOC_ID=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"][$i].documentId // \"no-id\"")
    ATT_COUNT=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"][$i].attachments | length")

    echo "[$CATEGORY] Document: $DOC_TYPE (ID: $DOC_ID) — $ATT_COUNT attachment(s)"

    for ((j=0; j<ATT_COUNT; j++)); do
      ATT_ID=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"][$i].attachments[$j].attachmentId // \"att-$j\"")
      SIDE=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"][$i].attachments[$j].side // \"unknown\"")
      MIME=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"][$i].attachments[$j].mimeType // \"image/jpeg\"")
      FILENAME=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"][$i].attachments[$j].filename // empty")
      DATA=$(echo "$BODY" | jq -r ".[\"$CATEGORY\"][$i].attachments[$j].data // empty")

      if [ -z "$DATA" ]; then
        echo "  ⚠ Attachment $ATT_ID ($SIDE): no data present, skipping"
        continue
      fi

      # Determine file extension from MIME type
      case "$MIME" in
        image/jpeg|image/jpg) EXT="jpg" ;;
        image/png)            EXT="png" ;;
        image/gif)            EXT="gif" ;;
        image/webp)           EXT="webp" ;;
        image/tiff)           EXT="tiff" ;;
        image/heic)           EXT="heic" ;;
        application/pdf)      EXT="pdf" ;;
        *)                    EXT="bin" ;;
      esac

      # Build a descriptive filename
      OUT_FILE="${OUTPUT_DIR}/${CATEGORY}_${DOC_TYPE}_${SIDE}_${ATT_ID}.${EXT}"

      # Strip data URI prefix if present (e.g. "data:image/jpeg;base64,")
      CLEAN_DATA=$(echo "$DATA" | sed 's/^data:[^;]*;base64,//')

      echo "$CLEAN_DATA" | base64 -d > "$OUT_FILE"
      FILE_SIZE=$(wc -c < "$OUT_FILE" | tr -d ' ')
      echo "  ✓ Saved: $(basename "$OUT_FILE") ($FILE_SIZE bytes)"
      TOTAL=$((TOTAL + 1))
    done
  done
done

echo ""
echo "Done! Downloaded $TOTAL attachment(s) to $OUTPUT_DIR/"
