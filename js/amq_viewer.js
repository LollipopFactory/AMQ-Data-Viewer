/*-----------------------------------------------------------------------------
                                 INTRO
-----------------------------------------------------------------------------*/
/*
This file pretty much constructs the entire page based on the json in the data
folder. On a more ideal webpage, the server would do this computation and
simply serve the built page. However, this was initially built (and still works
as) a standalone page that can be run locally with your own data.
*/


/*-----------------------------------------------------------------------------
                             UTIL FUNTIONS
-----------------------------------------------------------------------------*/

//returns a string representing the given r, g, b, a values
//the alpha component can be left out
const rgba_to_string = function(r, g, b, a=null) {
	let retval = '#';
	let format_component = function(component) {
		return ('00' + component.toString(16)).substr(-2)
	}
	retval += format_component(r);
	retval += format_component(g);
	retval += format_component(b);
	if(a != null) {
		retval += format_component(a);
	}
	return retval;
};

//convert hsv to rgb
//https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
const hsv_to_rgb = function(h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
};

/*-----------------------------------------------------------------------------
                            GLOBAL VARIABLES
-----------------------------------------------------------------------------*/
const data = new Map();
const stats = {
	total_songs: 0,
	total_guesses: 0,
	total_correct: 0,
};
const anime_names = new Set();


/*-----------------------------------------------------------------------------
                       LOADING AND COMPILING DATA
-----------------------------------------------------------------------------*/
//loads a json file
const load_json = async function(url) {
	//make the promise
	return new Promise( function(resolve, reject) {
		//create a http request
		let request = new XMLHttpRequest();
		request.open('GET', url);
		//lets the request know to expect a json file
		request.overrideMimeType("application/json");
		//await the eventual load or failure of the request
		request.onreadystatechange = function() {
			if(request.readyState === XMLHttpRequest.DONE) {
				if(request.status === 200) {
					//parse the json and store it in the results
					try {
						let result = JSON.parse(request.responseText);
						resolve(result);
					} catch(err) {
						//catch any parsing errors and reject
						reject(err);
					}
				} else {
					reject( Error( "Error loading json, Status code: " + request.status) );
				};
			};
		};
		//perform the load
		request.send();
	});
};

//adds a single song's data to the data map
const get_song_entry_key = (song_entry) => JSON.stringify( [song_entry.animeName, song_entry.animeType, song_entry.songName, song_entry.artistName] );
const update_song_entry = function( song_entry ) {
	// this is a key unique to each different song (with very few irrelevant exceptions, ex. ReLIFE)
	const key = get_song_entry_key( song_entry );
	if( data.has(key) ) {
		const value = data.get(key);
		value.videoLinks.add(song_entry.videoLink)
		data.set(key, value);
	}
	else {
		const value = {
			animeName: song_entry.animeName,
			alternativeNames: new Set(),
			wrongGuesses: new Set(),
			animeType: song_entry.animeType,
			songName: song_entry.songName,
			artistName: song_entry.artistName,
			videoLinks: new Set([ song_entry.videoLink ]),
			occurances: 0,
			correct: 0,
			outOf: 0,
		}
		data.set(key, value);
	}
};

//runs the above function for all data in a single json
const update_song_data = function( song_data ) {
	song_data.forEach( update_song_entry );
};

//takes an answer and capitalizes the first letter of each word
//(this may not actually be the correct capitalization, but it's a good enough approximation)
const format_alternate_answer = function( s ) {
	return s.toLowerCase()
	 .replace(/\w*/g,
	 (txt) => txt.charAt(0).toUpperCase() + txt.substr(1)
	);
};

//goes through the rounds in the json and updates all interesting stats about song data
//that can be learned through the plays
const update_round_data = function( round_data, song_list ) {
	round_data.forEach( function(round, round_num) {
		if(!round) return; //skip null rounds
		round.songIDs.forEach( function(songID, songNum) {
			if(songID === null) return; //skip null songs (song 0, or missed songs from recording starting late in a round)

			const song_entry = song_list[songID];
			const corrects = round.correctGuesses[songNum];
			const guesses = round.guesses && round.guesses[songNum];

			const key = get_song_entry_key( song_entry );
			const song_data = data.get(key);

			//update the song stats
			song_data.occurances++;
			song_data.outOf += corrects.length;
			song_data.correct += corrects.filter( (b) => b ).length;
			//update global stats
			stats.total_songs++;
			stats.total_guesses += corrects.length;
			stats.total_correct += corrects.filter( (b) => b ).length;

			anime_names.add( song_entry.animeName.toLowerCase() );
			//find alternate names
			if(guesses) { //may be undefined for early data
				const correct_names = guesses.filter( (_, i) => corrects[i] );
				//get each different current known alternative name (ignoring captilization)
				const unique_alternatives = new Set([song_entry.animeName.toLowerCase()]);
				for( let name of song_data.alternativeNames ) {
					unique_alternatives.add( name.toLowerCase() );
				}
				const start_size = unique_alternatives.size;
				//add any new alternatives
				for( let name of correct_names ) {
					anime_names.add( name.toLowerCase() );
					unique_alternatives.add(name.toLowerCase());
				}
				//if we added any alternatives, update the song data
				if( start_size < unique_alternatives.size ) {
					const formated_alternatives = new Set();
					for( let name of unique_alternatives ) {
						//don't add the default name
						if( name !== song_entry.animeName.toLowerCase() ) {
							formated_alternatives.add( format_alternate_answer(name) );
						}
					}
					song_data.alternativeNames = formated_alternatives;
				}

				//do the same for incorrect guesses
				const wrong_names = guesses.filter( (_, i) => !corrects[i] );
				//get each different current known incorrect names (ignoring captilization)
				const unique_wrongs = new Set([]);
				for( let name of song_data.wrongGuesses ) {
					unique_wrongs.add( name.toLowerCase() );
				}
				const wrong_size = unique_wrongs.size;
				//add any new incorrect names
				for( let name of wrong_names ) {
					if( name !== "..." && !(/^\s*$/.test(name))) {
						unique_wrongs.add(name.toLowerCase());
					}
				}
				//if we added any incorrect names, update the song data
				if( wrong_size < unique_wrongs.size ) {
					const formated_alternatives = new Set();
					for( let name of unique_wrongs ) {
						formated_alternatives.add( format_alternate_answer(name) );
					}
					song_data.wrongGuesses = formated_alternatives;
				}
			}

			data.set(key, song_data);
		});
	});
};

//completely adds the data from a single json into a useful form
const merge_in_json = function( new_data ) {
	update_song_data( new_data.songData );
	update_round_data( new_data.roundData, new_data.songData );
};


/*-----------------------------------------------------------------------------
                       COMPARISON FUNCTIONS
-----------------------------------------------------------------------------*/
//takes a list of comparison functions, and returns a new comparison function
//the returned function will apply the listed functions in order
//until one of them is non-zero, and will return that value
//if all comparisons return 0, the returned function will return 0
const create_comp = function( comps ) {
	return function(data_a, data_b) {
		for(let comp of comps) {
			const mag = comp(data_a, data_b);
			if(mag !== 0) {
				return mag;
			}
		}
		return 0;
	};
};

//creates a function that returns the requested property of the data
const by_property = (prop_name) => ((d) => d[prop_name]);
//returns comparison functions that compares the data value returned by the given function
const ord_comp = function( ord ) {
	return function( retriever ) {
		return function(data_a, data_b) {
			const val_a = retriever(data_a);
			const val_b = retriever(data_b);
			if( val_a !== val_b ) {
				return ord(val_a, val_b);
			}
			return 0;
		};
	};
};
//two ordering functions
const gt_ord = (a,b) => (a > b) ? 1 : -1;
const lt_ord = (a,b) => (a < b) ? 1 : -1;
//use those with the above function to get two main comparison components:
const gt_comp = ord_comp(gt_ord);
const lt_comp = ord_comp(lt_ord);

//a few specific comparisons
const comp_by_type = function(data_a, data_b) {
	const ordering = ["Opening", "Ending", "Insert"];
	const type_a = data_a.animeType.split(' ');
	const type_b = data_b.animeType.split(' ');
	const by_type = (t) => ordering.indexOf(t[0]);
	const by_order = (t) => parseInt(t[1]);
	return create_comp([
		gt_comp( by_type ),
		gt_comp( by_order ),
	])(type_a, type_b);
};
const outOf_check = function(data_a, data_b) {
	if(data_a.outOf === 0) return 1;
	if(data_b.outOf === 0) return -1;
	return 0;
};
const by_accuracy = (d) => (d.correct / d.outOf);

//these are the main comparison functions
const song_list_compare = create_comp( [
	gt_comp( by_property('animeName') ),
	comp_by_type,
	gt_comp( by_property('songName') ),
	gt_comp( by_property('artistName') ),
]);

const song_accuracy_compare = create_comp( [
	outOf_check,
	lt_comp( by_accuracy ),
	lt_comp( by_property('outOf') ),
	song_list_compare,
]);

const song_occurance_compare = create_comp( [
	lt_comp( by_property('occurances') ),
	song_accuracy_compare,
]);

const sorting_methods = {
	anime: song_list_compare,
	accuracy: song_accuracy_compare,
	appearances: song_occurance_compare,
};

/*-----------------------------------------------------------------------------
                        HTML BUILDING
-----------------------------------------------------------------------------*/
const add_song_info_node = function( song_data ) {
	const info_list = document.getElementById('info-listing');
	const template = document.getElementById('info-template');
	const info = template.cloneNode(true); //pass true to do a deep copy
	info.id = "";

	const set_info_text = function(class_name, text) {
		try {
			info.getElementsByClassName(class_name)[0].innerHTML = text;
		} catch(err) {
			console.error(err);
		}
	};
	const add_song_link = function( url ) {
		try {
			const row = info.getElementsByClassName('song-links')[0];
			const linkLine = document.createElement("span");

			const anchor = document.createElement('A');
			anchor.href = url;
			anchor.target = "_blank";
			anchor.innerHTML = url;
			
			//linkvii wrote the video embed stuff
			linkLine.appendChild(anchor);

			const play = document.createElement('button');
			play.innerHTML = "►";

			linkLine.appendChild(play);
			
			const vid = document.createElement("video");
			vid.setAttribute("width", "90%")
			vid.controls = "true";
			vid.preload = "none";
			vid.style.display = "none";
			
			const sr = document.createElement("source");
			sr.src = url;
			vid.appendChild(sr);

			play.vid = vid;
			play.onclick = toggle_video;
			
			
			row.appendChild(linkLine);
			row.appendChild(vid);

		} catch(err) {
			console.error(err);
		}
	};
	const set_stats = function( num, denom, occurances ) {
		const stat_elem = info.getElementsByClassName("song-stats")[0];
		if(denom > 0) {
			const percent = num / denom;
			const stats_string = Math.floor( percent * 100 ) + "% [" + num + "/" + denom + "]";

			const h = 1 - (percent / 3);
			const rgb = hsv_to_rgb(h, .6, .8);
			const stat_color = rgba_to_string(rgb.r, rgb.b, rgb.g);
			stat_elem.innerHTML = "<span style='color: " + stat_color + ";'>" + stats_string + "</span>";
		}
		else {
			stat_elem.innerHTML = "– [0/0]";
		}
		stat_elem.innerHTML += ", (appeared " + occurances + " time" + (occurances !== 1 ? "s" : "") + ")";
	};
	const list_alternatives = function( class_name, alternatives ) {
		const row = info.getElementsByClassName(class_name)[0];
		const add_alternative_row = function( name, should_hide ) {
			const span = document.createElement('span');
			if( should_hide ) {
				span.className = 'hidden-incorrect';
			}
			span.appendChild(document.createTextNode(name));
			row.appendChild(span);
		};
		//list possible known alternative answers
		if(alternatives.size > 0) {
			let num_shown = 0;
			for(let name of alternatives) {
				let should_hide = false;
				//if we are listing incorrects, only list the ones that are valid names
				if(class_name === 'song-incorrect' && !anime_names.has( name.toLowerCase() )) {
					should_hide = true;
				}
				else {
					num_shown++;
				}
				add_alternative_row(name, should_hide);
			}
			//create show more button if there are more incorrect answers to show
			if(class_name === 'song-incorrect' && num_shown < alternatives.size) {
				const show_more = document.createElement('span');
				show_more.innerHTML = (num_shown > 0) ? "Show More" : "Show";
				show_more.numShown = num_shown;
				show_more.className = 'show-incorrect';
				show_more.onclick = show_more_incorrect;
				row.appendChild(show_more);
			}
		}
		else {
			//if there are no known alternatives, remove the row altogether
			row.parentElement.remove();
		}
	};

	//add textual info
	set_info_text("anime-name",  song_data.animeName);
	set_info_text("song-type",   song_data.animeType.replace(' ', '&nbsp;') );
	set_info_text("song-name",   song_data.songName);
	set_info_text("song-artist", song_data.artistName);
	set_stats(song_data.correct, song_data.outOf, song_data.occurances);
	//list possible known links
	for(let url of song_data.videoLinks) {
		add_song_link(url);
	}
	//list possible alternatives and incorrect answers
	list_alternatives( 'song-alternatives', song_data.alternativeNames);
	list_alternatives( 'song-incorrect', song_data.wrongGuesses);

	//song song data on the node so it can be sorted again later
	info.song_data = song_data
	//add the node to the page
	info_list.appendChild(info);
};

const toggle_video = function() {
	const vid = this.vid;
	const disp = window.getComputedStyle(vid).getPropertyValue("display");
	const visible = disp !== "none";
	if (visible){
		this.innerHTML = "►";
		vid.style.display = "none";
		vid.pause();
	}else{
		vid.style.display = "inline";
		this.innerHTML = "X";
		vid.play();
	}
};
const show_more_incorrect = function() {
	const incorrects = this.parentNode;
	for( let hidden of incorrects.getElementsByClassName('hidden-incorrect') ) {
		hidden.style.display = 'initial';
	}
	this.onclick = show_less_incorrect;
	this.innerHTML = (this.numShown > 0) ? "Show Less" : "Hide";
};
const show_less_incorrect = function() {
	const incorrects = this.parentNode;
	for( let hidden of incorrects.getElementsByClassName('hidden-incorrect') ) {
		hidden.style.display = 'none';
	}
	this.onclick = show_more_incorrect;
	this.innerHTML = (this.numShown > 0) ? "Show More" : "Show";
};

/*-----------------------------------------------------------------------------
                           EVENT CALLBACKS
-----------------------------------------------------------------------------*/
const resort = function(value) {
	const compare_elems = function(a, b) {
		return sorting_methods[value](a.song_data, b.song_data);
	}
	//https://stackoverflow.com/questions/5066925/javascript-only-sort-a-bunch-of-divs
	const info_list = document.getElementById('info-listing');
	const info_array = Array.prototype.slice.call(info_list.children, 0);
	info_array.sort( compare_elems );
	info_list.innerHTML = "";
	info_array.forEach(info_list.appendChild.bind(info_list));
	localStorage.setItem('sorting-method', value);
};
//https://www.w3schools.com/howto/howto_js_scroll_to_top.asp
const scroll_to_top = function() {
	document.body.scrollTop = 0; // For Safari
	document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
};
//show the accuracy row for all song listings
const show_accuracies = function() {
	document.getElementById('info-listing').className = "accuracy-shown";
};
//show the accuracy row for all song listings
const hide_accuracies = function() {
	document.getElementById('info-listing').className = "accuracy-hidden";
};
//
const toggle_accuracy = function(cb) {
	localStorage.setItem('accuracy-shown', JSON.stringify(cb.checked));
	if(cb.checked) {
		show_accuracies();
	}
	else {
		hide_accuracies();
	}
};

/*-----------------------------------------------------------------------------
                                 MAIN
-----------------------------------------------------------------------------*/
// wrap the document DOM load event in a Promise
const build_dom = new Promise( function(resolve, reject) {
	document.addEventListener('DOMContentLoaded', resolve);
});

const record_name_to_data = async function(name) {
	const path = 'data/' + name + '.json';
	const json_data = await load_json(path);
	return merge_in_json(json_data);
};


(async function() {

//get and apply stored sorting method
let sorting_method = localStorage.getItem('sorting-method');
if(localStorage.getItem('sorting-method')) {
	//tell the dom to set this value once it's ready to do so
	build_dom.then( () =>
		document.getElementById('sort-select').value = sorting_method
	);
}
else {
	sorting_method = 'anime';
	localStorage.setItem('sorting-method', sorting_method);
}
//get and apply stored accuracy display option
let accuracy_shown = localStorage.getItem('accuracy-shown');
if(accuracy_shown) {
	//tell the dom to set this value once it's ready to do so
	build_dom.then( function() {
		const cb = document.getElementById("cb-accuracy");
		cb.checked = JSON.parse(accuracy_shown);
		if(cb.checked) {
			show_accuracies();
		}
		else {
			hide_accuracies();
		}
	});
}
else {
	localStorage.setItem('accuracy-shown', false);
}

//get the list of datafiles
let filenames = await load_json('data/filenames.json');
//load and read the data
await Promise.all( filenames.map( record_name_to_data ) );

//sort the data
const sorted_data = Array.from(data.values()).sort( sorting_methods[sorting_method] );
//make sure the dom is ready to be added to
await build_dom;
//add the data to the page
sorted_data.forEach( add_song_info_node );


})().catch( (e) => console.error(e) );
