//Import modules
var http = require('http');
var fs = require('fs');
var gui = require('nw.gui');
var os = require('os');
var url = require('url');
var zip = require('node-native-zip');

var win = gui.Window.get();

//Make sure that the devtools popup.
win.showDevTools();

console.log('Dropzone initialized');

//Function for starting the backend webserver for serving files to clients.
function start_server() {
	//Get settings from the localStorage database.
	
	var settings = JSON.parse(localStorage.settings);
	console.log('Started the webserver');
	
	//Create a new server object
	dropzone_server = http.createServer(function (req, res) {
		//When the request is root then :
		if (req.url == '/') {
			//Set header to HTML.
			res.setHeader('Content-Type','text/html');
			//Load the header.html
			res.write(fs.readFileSync('./resources/server/header.html'));
			res.write('<section id="list">');
			//Start of list generation.
			res.write('<table>');
			//Get files in ./files directory.
			var files = fs.readdirSync(process.cwd() + '/files/');
			res.write('<tr><th>Select</th><th>File</th><th>Download</th></tr>')
			for (i = 0; i < files.length; i++) {
				if (req.url == '/') var file_location = req.url + files[i]; 
				else var file_location = req.url + '/' + files[i];
				res.write('<tr><td><input type="checkbox" class="' + files[i] + '" /></td><td><a href="' + file_location + '">' + files[i] + '</a></td><td><a href="' + file_location + '?download">Download</a></td></tr>');
			}
			//Stop of list generation.
			res.write('</table>');
			//Load footer.
			res.write(fs.readFileSync('./resources/server/footer.html'));
			res.write('<script type="text/javascript"> $("header h1").html("' + getSettings().name + '") </script>');
		}
		else if (req.url =='/getdropzone') {
			res.setHeader('Content-disposition', 'attachment; filename=Dropzone v0.0.1.zip');
			res.setHeader('Content-type', 'application/octet-stream');
			res.end(fs.readFileSync('./resources/server/dropzone.zip'));
		}
		else {
			var request = url.parse(req.url);
			var reqtype = req.url.split('?');
			//Replace all of the URL encoded spaces.
			req.url = reqtype[0].replace(/%20/g, ' ');
			//Get the filename and extension.
			var filename = req.url.split('/')[req.url.split('/').length - 1];
			var file_extension = req.url.split('.')[req.url.split('.').length - 1];
			
			//If the file extension is .server, then load the file from server resources.
			if (file_extension == 'server') {
				var actual_file = req.url.split('.')[req.url.split('.').length - 3] + '.' + req.url.split('.')[req.url.split('.').length - 2];
				res.end(fs.readFileSync('./resources/server/' + actual_file));
			}
			else {
				if (request.query) {
					
					if (request.query.split('&')[0] == 'zip') {
						var query = request.query;
						query = query.replace(/%20/g, ' ');
						var files = query.split('&');
						console.log();
						var archive = new zip();
						for (i = 1; i < files.length; i++) {
							archive.add(files[i], fs.readFileSync('./files/' + files[i]));
						}
						
						var buffer = archive.toBuffer();
						var timestamp = os.uptime();
						
						fs.writeFileSync('./tmp/togo_' + timestamp + '.zip', buffer);
						//console.log(fs.existsSync('./tmp/togo_' + timestamp + '.zip', buffer));
						res.setHeader('Content-disposition', 'attachment; filename=Dropzone To go package.zip');
						res.end(fs.readFileSync('./tmp/togo_' + timestamp + '.zip'));
						
					}	
				}
				else if (fs.existsSync('./files' + req.url)) {
					if (request.query == 'download') {
						res.setHeader('Content-type','application/octet-stream');
						res.write(fs.readFileSync('./files' + req.url));
					}
					else if (request.query == 'raw') {
						res.write(fs.readFileSync('./files' + req.url));
					}
					else {
						//If the file extension is an image, show it to the user in the dropzone UI.
						if (file_extension == 'png' || file_extension == 'jpg' || file_extension == 'jpeg' || file_extension == 'gif') {
							res.write(fs.readFileSync('./resources/server/header.html'));
							var sidebar = makeDetailList('./files' + req.url, req.url);
							res.write(sidebar);
							//res.write(makeDetailList('./files' + req.url));
							res.write('<section id="image">');
							res.write('<h3>Image - ' + filename + '</h3>');
							res.write('<img src="' + req.url + '?raw" />');
							res.write(fs.readFileSync('./resources/server/footer.html'));
						}
						else if (file_extension == 'txt' || file_extension == 'cfg' || file_extension == 'yml' || file_extension == 'rtf' || file_extension == 'bat' || file_extension == 'properties'/* Probably more support for textfiles in the future. */) {
							res.write(fs.readFileSync('./resources/server/header.html'));
							var sidebar = makeDetailList('./files' + req.url, req.url);
							res.write(sidebar);
							res.write('<section id="text">');
							res.write('<h3>Text file : ' + filename + '</h3>');
							res.write('<div>');
							res.write(fs.readFileSync('./files' + req.url));
							res.write('</div>');
							res.write(fs.readFileSync('./resources/server/footer.html'));
						}
						else {
							res.setHeader('Content-type','text/plain');
							res.write(fs.readFileSync('./files' + req.url));	
						}
					}
					
					res.end();
				}
				else {
					res.end('File not found - 404.');
				}
			}
		}
		//Stop the response.
		res.end();
	
	}).listen(settings.port); //Listen to the port specified in the settings.
	
}

//Function for stopping the server.
function stop_server() {
	console.log('Stopped server');
	dropzone_server.close();
}

//Function for restarting the server.
function restart_server() {
	console.log('Restart server');
	stop_server();
	start_server();
}

//Function to reset served files.
function resetFiles() {
	var files = fs.readdirSync('./files/');
	//Get all of the files and remove them from the filesystem.
	for (i = 0; i < files.length; i++) {
		fs.unlinkSync('./files/' + files[i]);
	}
}

function makeDetailList(location, url) {
	var stats = fs.lstatSync(location);
	
	var file = {
			size : stats.size,
			changed : stats.mtime,
			type : location.split('.')[location.split('.').length - 1]
	}
	
	if (file.size > 1024) {
		file.size = Math.floor((file.size / 1024) * 10) / 10 + ' kB';
	}
	else if (file.size > 1024 * 1024) {
		file.size = file.size / Math.floor((1024 * 1024) * 10) / 10 + ' MB'; 
	}
	else if (file.size > 1024 * 1024 * 1024) {
		file.size = file.size / Math.floor((1024 * 1024 * 1024) * 10) / 10 + ' GB';
	}
	else {
		file.size += ' b';
	}
	
	var str = '<section id="sidebar">';
	str += '<h3>File details</h3>';
	str += '<ul>';
	str += '<li>Size : <span>' + file.size + '</span></li>';
	str += '<li>Extension/Type : <span>' + file.type + '</span></li>';
	str += '<li>Last changed : <br><span>' + file.changed + '</span></li>';
	str += '<li>Download : <a href="' + url + '?download">Download</a>';
	str += '</ul>';
	str += '</section>';
	
	console.log(str);
	
	return str
}

function getSettings() {
	var settings = JSON.parse(localStorage.settings);
	
	return settings;
}