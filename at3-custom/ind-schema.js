exports.main = [{
	name: "main",
	message: "select",
	type: "list",
	choices: [
		'search and download',
		'download with url'
	]
},
{
	name: "fileType",
	message: "Audio/Video",
	type: "list",
	choices: ['audio', 'video']
},
{
	name: "outputFolder",
	message: "Output Folder",
	// TODO: move below line into config
	default: "/media/l/C09021D69021D426/music/mousiki/",
	type: "input"
}
];


exports.url = [{
	name: "url",
	message: "url",
	type: "input"
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