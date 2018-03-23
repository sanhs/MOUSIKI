exports.main = [{
	name: "main",
	message: "select",
	type: "list",
	choces: [
		'search and download',
		'download with url'
	]
}];

exports.track = [{
	name: "title",
	message: "Title",
	type: "input"
}, {
	name: "artist",
	message: "Artist",
	type: "input"
}]

exports.search = function(choices) {
	return {
		name: "video",
		message: "Search Results",
		type: "list",
		choices: choices
	};
};