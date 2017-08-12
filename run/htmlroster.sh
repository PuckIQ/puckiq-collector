#!/bin/bash
SEASON=20162017
STARTID=2016020001
ENDID=2016021230

while [ $STARTID -lt $ENDID ]; do
  $(node ../games/htmlroster.js --season $SEASON --gameid $STARTID) > /dev/null
  let STARTID=STARTID+100
done;