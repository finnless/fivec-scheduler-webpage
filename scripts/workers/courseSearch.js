importScripts("../libs/fuzzysort.js");

onmessage = function(e) {
    let course_divs = expensiveCourseSearch(e.data[0], e.data[1], e.data[2], e.data[3]);

    postMessage(course_divs);
}

function createResultDiv(course, color, index) {
	let identifier = course.identifier;

	let course_div = "<div";
	course_div += " class=\"course-search-result unselectable\"";

	course_div += ` id="${identifier}"`;
    course_div += " tabindex=\"0\"";

	course_div += ` onclick="toggleCourseSelection(\'${identifier}\')"`;
    course_div += ` onmouseenter="setCourseDescription(\'${index}\')"`;
	course_div += ` style="background-color: ${color};">`;

	// Create checkbox
	course_div += ` <div class="checkbox"></div>`;

	let course_code = `<b>${course.identifier}</b>`;
	let status = `<span class="status-highlight ${course.status}" onclick="addSearchFilter(\'status:${course.status}\')">${course.status}</span>`;

	let prereqs = "";
	let coreqs = "";

	// Create pre and co req boxes
	if (course.prerequisites.length > 0) {
		prereqs = `<span class="prereqs-highlight" onclick="addSearchFilter(\'prereq:some\')">Prereq(s)</span>`;
	}

	if (course.corequisites.length > 0) {
		coreqs = `<span class="coreqs-highlight" onclick="addSearchFilter(\'coreq:some\')">Coreq(s)</span>`;
	}


	// Put the course code and status in a div on the right
	let num_students = `<span class="align-right"><b>${course.seats_taken}/${course.max_seats}${prereqs}${coreqs}${status}</b></span>`;

	course_div += `${course_code}: ${course.title} ${num_students}`;
    course_div += "</div>";

	return course_div;
}

function toApiSchool(school) {
	let l_school = school.toLowerCase();
	if (["hmc", "hm", "harvey", "mudd", "harveymudd", "harvey-mudd"].includes(l_school)) {
		return "HarveyMudd";
	} else if (["cmc", "cm", "claremont", "mckenna", "claremontmckenna", "claremont-mckenna"].includes(l_school)) {
		return "ClaremontMckenna";
	} else if (["scripps", "scripp", "scrps", "scrip", "scrips", "sc"].includes(l_school)) {
		return "Scripps";
	} else if (["pm", "po", "pomona", "pomna", "pom"].includes(l_school)) {
		return "Pomona"
	} else if (["pz", "pitz", "pitzer", "pitze", "ptz"].includes(l_school)) {
		return "Pitzer"
	}
}

function tweakSearch(string) {
	let return_string = string.toLowerCase();

	// Common replacements
	// Type can be "full" or "any"
	// Full only matches full tokens/words separated by spaces
	const replacements = [
		{ type: "full", search: "cs", replace: "csci" },
		{ type: "full", search: "e", replace: "engr"},
		{ type: "full", search: "hmc", replace: "HarveyMudd" },
		{ type: "full", search: "cmc", replace: "ClaremontMckenna" },
		{ type: "full", search: "harvey mudd", replace: "HarveyMudd" },
		{ type: "full", search: "claremont mckenna", replace: "ClaremontMckenna" },
	];

	for (let replacement of replacements) {
		if (replacement.type == "full") {
			return_string = return_string.replaceAll(new RegExp(`\\b${replacement.search}\\b`, 'g'), replacement.replace);
		} else if (replacement.type == "any") {
			return_string = return_string.replaceAll(replacement.search, replacement.replace);
		}
	}

	// Add a 0 to the course number
	let num_corrected_string = "";

	for (part of return_string.split(" ")) {
		// JS is horrible, to see if a string is a number or not
		// I have to parse it then take the output and convert
		// that back to a string.
		//
		// Then I can compare it to the string value of "NaN" to see
		// if it's a number or not.
		if (`${parseInt(part)}` != "NaN") {
			if (part.length == 2) {
				num_corrected_string += ` 0${part}`;
			} else if (part.length == 1) {
				num_corrected_string += ` 00${part}`;
			} else {
				num_corrected_string += ` ${part}`;
			}
		} else {
			num_corrected_string += ` ${part}`;
		}
	}

	return_string = num_corrected_string;

	return return_string.trim().toLowerCase();
}

function search_courses(query, all_courses_global, filters, hmc_mode) {
    const options = {
        limit: 100, // don't return more results than you need!
        allowTypo: true, // if you don't care about allowing typos
        threshold: -10000, // don't return bad results
        keys: ['identifier', 'title', 'instructorString'], // keys to search
    }

    let results = [];

	if (query.trim() == "") {
		results = all_courses_global;
	} else {
		if (query.includes(" ")) {
			const terms = query.split(" ");
			for (let search_term of terms) {
				let temp_results = fuzzysort.go(search_term.trim(), all_courses_global, options);
				
				if (results.length > 0) {
					results = results.filter(t => temp_results.map(t => t.obj.identifier).includes(t.obj.identifier));
				} else {
					results = temp_results;
				}
			}
	
			if (results.length < 10) {
				const results_dash = fuzzysort.go(terms.join("-"), all_courses_global, options);
				const results_norm = fuzzysort.go(query, all_courses_global, options);
				// Join results for all unique results
				const results_combined = join_results(results_dash, results_norm);
				results = join_results(results_combined, results);
			}
			
			results = results.sort((a, b) => b.score - a.score);
			
		} else {
			results = fuzzysort.go(query, all_courses_global, options);
		}
	}
    
	// Apply filters
	for (let key of Object.keys(filters)) {
		if (["status", "dept", "id", "code"].includes(key)) {
			results = results.filter(t => (t.obj || t)[key].toLowerCase() == filters[key].toLowerCase());
		} else if (key == "with") {
			results = results.filter(t => (t.obj || t).instructorString.toLowerCase().replaceAll(".", "").includes(filters[key].replaceAll("-", " ").replace(".", "").toLowerCase()));
		} else if (key == "on") {
			let days_to_search = filters[key].split(",").map(day => capitalize(day));
			results = results.filter(t => (t.obj || t).timing.map(e => e.days).some(k => k.some(l => days_to_search.includes(l))));
		} else if (key == "credits") {
			if (hmc_mode) {
				results = results.filter(t => (t.obj || t).credits_hmc/100 == filters[key]);
			} else {
				results = results.filter(t => (t.obj || t).credits/100 == filters[key]);
			}
		} else if (key == "section") {
			results = results.filter(t => parseInt((t.obj || t).section) == filters[key]);
		} else if (key == "at") {
			results = results.filter(t => (t.obj || t).timing.map(e => e.location.school).flat().includes(toApiSchool(filters[key])));
		} else if (key == "location") {
			results = results.filter(t => (t.obj || t).timing.map(e => e.location.building).some(x => x.toLowerCase().includes(filters[key].toLowerCase())));
		} else if (key == "prereq") {
			if (filters[key].toLowerCase() == "none") {
				results = results.filter(t => (t.obj || t).prerequisites.length == 0);
			} else if (filters[key].toLowerCase() == "some") {
				results = results.filter(t => (t.obj || t).prerequisites.length > 0);
			} else {
				results = results.filter(t => (t.obj || t).prerequisites == filters[key]);
			}
		} else if (key == "coreq") {
			if (filters[key].toLowerCase() == "none") {
				results = results.filter(t => (t.obj || t).corequisites.length == 0);
			} else if (filters[key].toLowerCase() == "some") {
				results = results.filter(t => (t.obj || t).corequisites.length > 0);
			} else {
				results = results.filter(t => (t.obj || t).corequisites == filters[key]);
			}
		} else if (key == "after" || key == "before") {
			let time_to_search = [0, 0];

			let time = filters[key].toLowerCase();
			let offset = 0;

			// Convert to 24 hour time
			if (time.includes("p")) {
				time = time.split("p")[0];
				
				if (time.substring(0,2) != "12") {
					offset = 12;				
				}

			} else if (time.includes("a")) {
				time.split("a")[0];

				if (time.substring(0,2) == "12") {
					offset = -12;				
				}
			}

			// Parse either just hour
			let hour = parseInt(time);

			if (hour != NaN) { 
				time_to_search = [hour + offset, 0];
			} else {
				return;
			}

			results = results.filter(t => (t.obj || t).timing.some(e => {
				// Return false if day is not included in "on" filter
				if (filters["on"] != null) {
					let days_to_search = filters["on"].split(",").map(day => capitalize(day));
					if (!e.days.some(l => days_to_search.includes(l))) {
						return false;
					}	
				}

				if (key == "after") {
					let start_time = e.start_time.split(":").map(i => parseInt(i));
					if (timeDiffMins(time_to_search, start_time) >= 0) {
						return true;
					}
				} else {
					let end_time = e.end_time.split(":").map(i => parseInt(i));
					if (timeDiffMins(time_to_search, end_time) <= 0) {
						return true;
					}
				}
			}));
		}
	}

    return results;
}

function timeDiffMins(time_arr_a, time_arr_b) {
    // Calculate time difference in minutes
    let time_diff = (time_arr_b[0] - time_arr_a[0]) * 60;
    time_diff += (time_arr_b[1] - time_arr_a[1]);

    return time_diff;
}

function join_results(arr1, arr2) {
    return arr1.concat(arr2.filter((t, i) => !arr1.map(t => t.obj.identifier).includes(t.obj.identifier)))
}

function capitalize(s) {
    return s && s[0].toUpperCase() + s.slice(1);
}

// Gets any pair of "key:value" pairs from the query string
// and returns both as an object
function getFilters(input) {
	let split = input.split(" ");

	let filters = {};
	let wanted_search_term = "";

	for (let part of split) {
		if (part.includes(":")) {
			let split_part = part.split(":");
			filters[split_part[0]] = split_part[1];
		} else {
			wanted_search_term += part + " ";
		}
	}

	wanted_search_term = wanted_search_term.trim();

	return {filters: filters, input: wanted_search_term};
}

function expensiveCourseSearch(input, all_courses_global, colors, hmc_mode) {
    let results = [];

    if (input == "") {
        results = all_courses_global;
	} else {
		const filters_object = getFilters(input);

		const search_term = tweakSearch(filters_object.input, all_courses_global);

		console.log(`${filters_object.input} => ${search_term}`);
		
		results = search_courses(search_term, all_courses_global, filters_object.filters, hmc_mode);
	}

    let output = [];

    for (let i = 0; i < results.length; i++) {
        let course = results[i].obj ?? results[i];
        let course_div = createResultDiv(course, colors[i % colors.length], course.descIndex);

        output.push(course_div);
    }

    return output;
}