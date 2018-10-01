/*
To use (yeah this is not great, sorry):
- Copy-Paste this file into your browser's console after loading the amq page
- Run 'amq.start()' in the console after starting a game
  You only need to do this once per session, not once per round
- Once you want the data, press the `~ key on the keyboard
  this will copy the data into your clipboard so you can paste it into a text editor
- Save that as a json

I tried making this a firefox extention, but it ended up being more trouble than it was worth.
*/


amq = {
    songData : [],
    roundData : [],
    currentRoundNum : 0,
    currentSongNum : 0,
    playerData : {},
};

amq.addToScore = function(scores, name, correct) {
    if (!(name in scores)) {
        scores[name] = {
            correct : 0,
            outOf : 0,
        }
    }
    scores[name].outOf += 1;
    if (correct) {
        scores[name].correct += 1;
    }
}

amq.nameFromAvatarElem = function( elem ) {
    return elem.id.substr(9);
}

amq.start = function() {
    let newRound = function() {
        amq.currentRoundNum += 1;
        amq.roundData[amq.currentRoundNum] = {
            songIDs : [],
            playerNames : [],
            correctGuesses : [],
            guesses: [],
            scores : {},
        };
        //get the players in this round
        let avatarElems = document.getElementsByClassName("qpAvatarContainer");
        let playerNum;
        for(playerNum = 0; playerNum < avatarElems.length; playerNum += 1) {
            amq.roundData[amq.currentRoundNum].playerNames.push( amq.nameFromAvatarElem(avatarElems[playerNum]) );
        }
    }
    //initialize round data
    newRound();
    //observe the anime title panel, waiting for the name reveal
    const nameHider = document.getElementById('qpAnimeNameHider');
    const songCount = document.getElementById('qpCurrentSongCount');
    amq.observer = new MutationObserver(function(){
        if(nameHider.classList.contains("hide")){
            //when the name is revealed, record the song data
            amq.songData.push({
                animeName : document.getElementById("qpAnimeName").textContent,
                animeType : document.getElementById("qpSongType").textContent,
                videoLink : document.getElementById("qpSongVideoLink").href,
                songName : document.getElementById("qpSongName").textContent,
                artistName : document.getElementById("qpSongArtist").textContent
            });
            //determine song number, and if we've advanced a round
            //this can be inaccurate if the tracker was not running between rounds, but you're losing data in that case anyway
            const songNum = parseInt(songCount.textContent);
            if(songNum <= amq.currentSongNum) {
                newRound();
            }
            amq.currentSongNum = songNum;
            const curRound = amq.roundData[amq.currentRoundNum];
            curRound.songIDs[songNum] = amq.songData.length - 1;
            //see who got it correct
            let avatarElems = document.getElementsByClassName("qpAvatarContainer");
            let corrects = [];
            let guesses = [];
            let playerNum;
            for(playerNum = 0; playerNum < avatarElems.length; playerNum += 1) {
                const name = curRound.playerNames[playerNum];
                const correct = avatarElems[playerNum].getElementsByClassName("qpAvatarAnswerContainer")[0].classList.contains("rightAnswer");
                const answer = avatarElems[playerNum].getElementsByClassName("qpAvatarAnswerText")[0].innerText;
                corrects.push(correct);
                guesses.push(answer);
                amq.addToScore(amq.playerData, name, correct);
                amq.addToScore(curRound.scores, name, correct);
            }
            curRound.correctGuesses[songNum] = corrects;
            curRound.guesses[songNum] = guesses;
        };
    });
    amq.observer.observe(nameHider,  { attributes: true, childList: false });

    //add a listener to copy some info from the page to the clipboard when a key is pressed
    window.onkeyup = function(e) {
       let key = e.keyCode ? e.keyCode : e.which;
       //check specifically for pressing the `~ key
       if(key == 192) {            
            //dump data as json
            let copyData = {
                songData : amq.songData,
                roundData : amq.roundData,
                playerData : amq.playerData,
            }
            let copiedText = JSON.stringify(copyData, null, 2);
            //copy it to the clipboard
            //(this can potentially visibly add the copied text to the page briefly; I won't consider this a problem)
            let copyElem = document.createElement("textarea");
            copyElem.value = copiedText;
            document.body.appendChild(copyElem);
            copyElem.select();
            document.execCommand("copy");
            document.body.removeChild(copyElem);
       }
    };
};

amq.quit = function() {
    amq.observer.disconnect();
}