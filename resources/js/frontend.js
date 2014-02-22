var http = require('http');
var fs = require('fs');
var gui = require('nw.gui');
var os = require('os');
var url = require('url');
var zip = require('node-native-zip');
var AdmZip = require('adm-zip');
var openssl = require('openssl-wrapper');
var crypto = require('crypto');


//Set the current_tab variable to the home tab : dropzone.
var current_tab = 'dropzone';

var win = gui.Window.get();
win.showDevTools();

function AppInfo () {
    this.name = "";
    this.environnement = "";
//    getInfo: function () {
//        return this.color + ' ' + this.type + ' apple';
//    }
}

// Extract extension of a filename e.g. blabla.zip => zip
function extensionOf(filename) {
    return filename.substr((~-filename.lastIndexOf(".") >>> 0) + 2);
}

function analyseProvisionning(path) {
    console.info('Analysing provisionning', path);
//    var Q = require('q');

     console.log('result=', openssl.qExec('cms.verify', path, {inform: 'DER', noverify: true}));
//        .then(function decryptEnvelopedData() {
//            return opensslExec('cms.decrypt', envelopedData, {inform: 'DER', recip: __dirname + '/myCertificate.crt', inkey: __dirname + '/myCertificate.key'})
//        })
//        .then(function debugOutput(data) {
//            console.log(data);
//        })
}

//Function for when the page is ready.
function onReady() {

    var ciphers = crypto.getCiphers();
    console.log(ciphers);
    var hashes = crypto.getHashes();
    console.log(hashes);

	//Load the settings and start the backend webserver.
	loadSettings();
	// start_server();
	
	//Define the dropzone DOM element.
	var dropzone = document.getElementById('dropzone');
	
	//Event for when the client drops file in the dropzone.
	dropzone.ondrop = function (e) {
		
		//Make sure that the window doesn't show the file in plain text.
		e.preventDefault();
		
		//Change the inside message of the dropzone to 'Drop files in here to instantly share them!'
		document.getElementById('drop_message').innerHTML = 'Drop files in here to check your IPA';
		
		//Make sure that all of the files that are dropped in get linked inside the ./files/ folder inside the application.
		for (i = 0; i < e.dataTransfer.files.length; i++) {

			var path = e.dataTransfer.files[i].path;
			path = path.replace(/\\/g, "/");
            var filename = path.split('/')[path.split('/').length - 1];

            console.log('Path is', e.dataTransfer.files[i].path);
            console.log('Filename is', filename);

            // TODO: HERE WE SHOULD CHECK EXTENSION

            var tmpDir = process.cwd() + '/tmp/' + new Date().getTime() + Math.random();
            var linkPath = tmpDir + '/' + filename;
            console.log('Link Path is', linkPath);
            fs.mkdirSync(tmpDir);

            // If link was already created in the tmp dir, create it
            if (!fs.existsSync(linkPath)) {
                fs.linkSync(e.dataTransfer.files[i].path, linkPath);
            }

            // Check file extension
            switch (extensionOf(filename)) {
                case 'ipa': // Unzip .ipa, extract the .mobileprovision, and analyse it
                    console.info('.ipa file... processing...');

                    var zip = new AdmZip(linkPath);
                    zip.getEntries().some(function(zipEntry) {
                        if (extensionOf(zipEntry.entryName) === 'mobileprovision') {
                            console.log(zipEntry.toString());
                            zip.extractEntryTo(zipEntry.entryName, tmpDir, false, true);
                            return analyseProvisionning(tmpDir + zipEntry.name);
                        }
                    });
                    break;
                case 'app': // Read the .app, copy the .mobileprovision, and analyse it
                    console.info('.app file... processing...');
                    fs.readdirSync(tmpDir).some(function(file) {
                        if (extensionOf(file) === 'mobileprovision') {
                            console.log('Founded ', file);
                            fs.copyFile(file, tmpDir, function(e) {
                                return analyseProvisionning(tmpDir + '/embedded.mobileprovision');
                            });
                        }
                    });
                    break;
                case 'mobileprovision': // Just analyse the .mobileprovision
                    console.info('.mobileprovision file... processing...');
                    analyseProvisionning(linkPath);
                    break;
                default:
                     alert('FU !');
                    return;
            }

            // FOR IPA ONLY
            // Unzip IPA -> Payload (dir) -> *.app (dir) -> embedded.mobileprovision
//            fs.createReadStream(linkPath).pipe(unzip.Extract({
//                path: dirPath + '/unzipped'
//            }));


			//In windows, copy the file to the directory if it's another system, create a symbolic link.
			// if (os.platform() != 'win32') {
			// 	fs.symlinkSync(e.dataTransfer.files[i].path, process.cwd() + '/files/' + filename, 'file');	
			// }
			// else {
				
			
		}
		
	}
	
	//An event for when the user enters the drag field with files.
	dropzone.ondragenter = function () {
		document.getElementById('drop_message').innerHTML = 'Let go of the mouse button to check your IPA.';
	}
	
	//Another event for when the user leaves the dropzone.
	dropzone.ondragleave = function () {
		document.getElementById('drop_message').innerHTML = 'Drop files in here to check your IPA';
	}
	
	//Events for the navigation buttons.
	$('ul#menubar li').click(function (e) {
		if (e.toElement.className != 'reset') {
			go(e.toElement.className);
		}
		else if (e.toElement.className == 'reset' && e.which == 2) {
			resetFiles();
			feedback('Reset all hosted files.');
		}
		else {
			feedback('Middle-click to reset hosted files.');
		}
	
	});
}

//Function for switching tabs inside the application.
function go(tab) {
	var speed = 1500;
	if (tab == current_tab) return;
	else current_tab = tab;
	$('section').fadeOut(speed, function () {
		setTimeout(function () {
			$('section#' + tab ).fadeIn(speed);
		},speed);
	});
}

//Load settings function.
function loadSettings() {
	console.log('Loaded settings');
	var port_setting = document.getElementById('port_setting');
	var name_setting = document.getElementById('name_setting');
	
	if (!(localStorage.settings)) {
		var settings = {
				port : 3000,
				name : "Dropzone"
		}
	}
	else {
		var settings = JSON.parse(localStorage.settings);
	}
	
	port_setting.value = settings.port;
	name_setting.value = settings.name;
	
	port_setting.onkeyup = function (e) {
		if (e.which == 13) {
			extractSettings();
		}
	}
	name_setting.onkeyup = function (e) {
		if (e.which == 13) {
			extractSettings();
		}
	}
	localStorage.setItem('settings', JSON.stringify(settings));
}

//A function for extracting settings.
function extractSettings() {
	console.log('Extracted settings.');
	var port_setting = document.getElementById('port_setting').value;
	var name_setting = document.getElementById('name_setting').value;
	
	var settings = {
			port : port_setting,
			name : name_setting
	}
	localStorage.setItem('settings', JSON.stringify(settings));
}

//A feedback function to provide feedback to the client.
function feedback(msg) {
	var speed = 400;
	var wait = 2000;
	
	$('div#alert').html(msg);
	$('div#alert').fadeIn(speed, function () {
		setTimeout(function () {
			$('div#alert').fadeOut(speed);
		}, wait);
	});
}