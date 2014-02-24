var http = require('http'),
    fs = require('fs'),
    gui = require('nw.gui'),
    os = require('os'),
    url = require('url'),
    AdmZip = require('adm-zip'),
    plist = require('plist'),
    exec = require('child_process').exec;


//Set the current_tab variable to the home tab : dropzone.
var current_tab = 'dropzone';

var win = gui.Window.get();
win.showDevTools();

function resetUI () {
    var $list = $('#results ul');

    $list.empty();
}

function AppInfo () {
    this.name = "";
    this.environnement = "";
    this
//    getInfo: function () {
//        return this.color + ' ' + this.type + ' apple';
//    }
}

// Extract extension of a filename e.g. blabla.zip => zip
function extensionOf(filename) {
    return filename.substr((~-filename.lastIndexOf(".") >>> 0) + 2);
}


function copyFile(source, target, cb) {
    var cbCalled = false;

    var rd = fs.createReadStream(source);
    rd.on("error", function(err) {
        done(err);
    });
    var wr = fs.createWriteStream(target);
    wr.on("error", function(err) {
        done(err);
    });
    wr.on("close", function(ex) {
        done(null);
    });
    rd.pipe(wr);

    function done(err) {
        if (!cbCalled) {
            cb(err);
            cbCalled = true;
        }
    }
}

function displayResults(results) {
    var $list = $('#results ul');

    results['ProvisionedDevices'].some( function(item) {
        $list.append(
            $('<li>').append(
                $('<span>').attr('class', 'tab').append(item)
        ));
    });

}

function analyseFailed(err) {
    alert(err);
}

function analyseProvisionning(path) {
    console.info('----------------------------------');
    console.info('Analysing provisionning', path);

    // TODO: Find a way to NOT use exec -> EVIL. Maybe we may achieve it using crypto, node-forge or something else ?
    var child = exec('openssl smime -inform DER -verify -in ' + path,
        function (error, stdout, stderr) {
            if (error === null) {
                var result = plist.parseStringSync(stdout);
                console.log('result =', result);
                displayResults(result);
            } else {
                console.error('exec error: ' + error);
            }
        });
}

//Function for when the page is ready.
function onReady() {

	//Load the settings and start the backend webserver.
	loadSettings();
	// start_server();
	
	//Define the dropzone DOM element.
	var dropzone = document.getElementById('dropzone');
	
	//Event for when the client drops file in the dropzone.
	dropzone.ondrop = function (e) {

        //Make sure that the window doesn't show the file in plain text.
        e.preventDefault();

        resetUI();

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

            console.info('-----------------------------------');
            // Check file extension
            switch (extensionOf(filename)) {
                case 'ipa': // Unzip .ipa, extract the .mobileprovision, and analyse it
                    console.info('.ipa file... processing...');

                    var zip = new AdmZip(linkPath),
                        entries = zip.getEntries();

                    for (var i = 0; i < entries.length; ++i) {
                        if (extensionOf(entries[i].entryName) === 'mobileprovision') {
                            zip.extractEntryTo(entries[i].entryName, tmpDir, false, true);
                            return analyseProvisionning(tmpDir + '/' + entries[i].name);
                        }
                    }
                    return analyseFailed('No provisionning found in ' + entries[i].name);

                case 'app': // Read the .app, copy the .mobileprovision, and analyse it
                    console.info('.app file... processing...');

                    // We check only at the root of .app
                    var files = fs.readdirSync(linkPath);

                    for (var i = 0; i < files.length; ++i) {

                        if (extensionOf(files[i]) === 'mobileprovision') {
                            // TODO: Check stream creation errors
                            console.log('rStream =', linkPath + '/' + files[i]);
                            console.log('wStream =', tmpDir + '/' + files[i]);

                            copyFile(linkPath + '/' + files[i], tmpDir + '/' + files[i], function(err) {
                                if (err === null) {
                                    console.log('FINAAAAAL', tmpDir + '/' + files[i]);
                                    return analyseProvisionning(tmpDir + '/' + files[i]);
                                } else {
                                    return analyseFailed('Error while copying provisionning :', err);
                                }
                            });
                        }
                    }

                case 'mobileprovision': // Just analyse the .mobileprovision
                    console.info('.mobileprovision file... processing...');
                    analyseProvisionning(linkPath);
                    break;
                default:
                     alert('FU !');
                    return;
            }

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