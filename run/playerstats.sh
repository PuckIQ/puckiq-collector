#!/bin/bash
SEASONSTART=2010
SEASON=$((($SEASONSTART*10000)+($SEASONSTART+1)))
STARTID=$((($SEASONSTART*1000000)+20001))
ENDID=$((($SEASONSTART*1000000)+21230))

INCREMENT=1
SITUATION=3v5

SITUATION=('6v6' '6v5' '6v4' '6v3' '5v6' '5v5' '5v4' '5v3' '4v6' '4v5' '4v4' '4v3' '3v6' '3v5' '3v4' '3v3')

echo $(date)

while [ $STARTID -lt $ENDID ]; do
  for i in ${SITUATION[@]}; do
    $(node ../crunch/playerstats.js --gameid $STARTID --situation $i >> ../logs/playerstats.log)
  done;
  let STARTID=STARTID+INCREMENT
done;

echo $(date)