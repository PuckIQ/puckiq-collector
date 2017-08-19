#!/bin/bash
SEASONSTART=2010
SEASON=$((($SEASONSTART*10000)+($SEASONSTART+1)))
STARTID=$((($SEASONSTART*1000000)+20001))
ENDID=$((($SEASONSTART*1000000)+21230))

INCREMENT=10

echo $(date)

while [ $STARTID -lt $ENDID ]; do
  echo $STARTID
  $(node ../games/htmlroster.js --season $SEASON --gameid $STARTID --increment $INCREMENT >> ../logs/htmlroster.log)
  let STARTID=STARTID+INCREMENT
  sleep 10s
done;

echo $(date)