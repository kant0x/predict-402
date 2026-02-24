#!/bin/bash
while true; do
    echo "[$(date)] Starting agent..." >> agent.log
    python3 -u agent.py >> agent.log 2>&1
    EXIT_CODE=$?
    echo "[$(date)] Agent crashed with exit code $EXIT_CODE. Restarting in 5s..." >> agent.log
    sleep 5
done
