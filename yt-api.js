/** 
this file's scope
youtube-apis
search a given query
find the results
pick a video and get its url
*/

var search = url: 'https://www.googleapis.com/youtube/v3/search?part=snippet&key=' + API_GOOGLE + localePart + '&maxResults=15&q=' + encodeURIComponent(query),
