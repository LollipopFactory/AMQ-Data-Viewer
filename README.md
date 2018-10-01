## AMQ Data Viewer

The main description of this webpage can be found [on the about page](https://lollipopfactory.github.io/AMQ-Data-Viewer/about.html). This repo also contains a few tools for those interested in recording data themselves to view with a local copy of the page.

## Recording Data

`tools/amq.js` allows you to record data of AMQ sessions. It is fairly awkward to use, but the process is as follows:

* Copy-Paste the entirety of `tools/amq.js` into your browser's console after loading the AMQ page.
* Run `amq.start()` in the console after starting a game. You only need to do this once per session, not once per round.
* Once you want the data, press the \`~ key on the keyboard. This will copy the data into your clipboard so you can paste it into a text editor.
* Save that as a `.json`.

You will also need to make sure that `data/filenames` lists the names of all data files (without the `.json` extension) you want to be considered.

## Anonymizing Data

`tools/anonymize.py` is a short python script that removes all player names from the data, leaving only what is necessary for the webpage. It might only work on Windows. To use it, have python, and then run:

`python tools/anonymize.py infile outfile`