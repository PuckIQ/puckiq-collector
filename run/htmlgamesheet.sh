#!/bin/bash
SEASONSTART=2011
SEASON=$((($SEASONSTART*10000)+($SEASONSTART+1)))
STARTID=$((($SEASONSTART*1000000)+20001))
ENDID=$((($SEASONSTART*1000000)+21230))

echo $(date)

while [ $STARTID -lt $ENDID ]; do
  $(node ../games/htmlgamesheet.js --season $SEASON --gameid $STARTID)
  let STARTID=STARTID+10
done;

echo $(date)