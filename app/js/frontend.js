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

function resetUI() {
    $('#panel-results').css('visibility', 'hidden');
    $('#list-entitlements').empty();
    $('#list-udid').empty();
}

function AppInfo() {
    this.name = '';
    this.environnement = '';
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
    rd.on("error", function (err) {
        done(err);
    });
    var wr = fs.createWriteStream(target);
    wr.on("error", function (err) {
        done(err);
    });
    wr.on("close", function (ex) {
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
    var $list;
    var text;
    var i = 0,
        obj = null;

    $('#panel-results').css('visibility', 'visible');

    // Entitlements
    obj = results['Entitlements'];
    $list = $('#list-entitlements');

    // Dev or Prod ?
    text = 'Debug : ' + ((obj['get-task-allow'] === undefined ||
                          obj['get-task-allow'] === null) ? '?' : (obj['get-task-allow'] ? 'true' : 'false'));
    $list.append($('<li class="list-group-item">').append(text));

    // Push
    text = 'Push : ' + ((obj['aps-environment'] === undefined ||
                         obj['aps-environment'] === null) ? 'NO' : obj['aps-environment']);
    $list.append($('<li class="list-group-item">').append(text));

    // Conclusion
    text = 'Conclusion : ';
    if (results['Entitlements']['get-task-allow'] && results['ProvisionedDevices'] !== undefined) {
        text += 'Development';
    } else if (!results['Entitlements']['get-task-allow'] && results['ProvisionedDevices'] !== undefined) {
        text += 'AdHoc';
    } else if (!results['Entitlements']['get-task-allow'] && results['ProvisionsAllDevices'] !== undefined) {
        text += 'InHouse';
    } else if (!results['Entitlements']['get-task-allow'] && results['ProvisionedDevices'] === undefined) {
        text += 'AppStore';
    } else {
        text += 'Unknown';
    }
    $list.append($('<li class="list-group-item">').append(text));

    // UDID
    obj = results['ProvisionedDevices'];
    $list = $('#list-udid');
    if (obj !== undefined && obj !== null) {
        for (i = 0; i < obj.length; ++i) {
            $list.append($('<li class="list-group-item">').append(obj[i]));
        }
    }
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
 }


$( document ).ready(function() {
	//Load the settings and start the backend webserver.
	loadSettings();


    $('#panel-results').css('visibility', 'hidden');


    var $ipa_dropzone = $('#dropzone')[0];
    var $certif_dropzone = $('#certif_dropzone')[0];

    $certif_dropzone.ondrop = function (e) {
        e.preventDefault();
    }
    $certif_dropzone.ondragenter = function (e) {
        $(this).css('border-color', 'yellow');
        if (e.dataTransfer.files.length > 1) {
            alert('NO');
        }
    }
    $certif_dropzone.ondragleave = function (e) {
        $(this).css('border-color', 'red');
    }

    //Event for when the client drops file in the dropzone.
    $ipa_dropzone.ondrop = function (e) {
        e.preventDefault();
        resetUI();
        // Get srcPath and filename
        var srcPath = e.dataTransfer.files[0].path;
        srcPath = srcPath.replace(/\\/g, "/");
        var filename = srcPath.split('/')[srcPath.split('/').length - 1];
        console.log('srcPath =', e.dataTransfer.files[0].path);
        console.log('filename =', filename);

        // Check extension's file
        switch (extensionOf(filename)) {
            case 'ipa':
            case 'app':
            case 'mobileprovision':
                break;
            default:
                return analyseFailed('Bad extension file');
        }

        // Create tmp directory which should be unique
        var tmpDir = process.cwd() + '/../tmp/' + new Date().getTime() + Math.random();
        fs.mkdirSync(tmpDir);

        // Copy file in tmpDir
        var targetPath = tmpDir + '/' + filename;
        console.log('targetPath =', targetPath);
        copyFile(srcPath, tmpDir + '/' + filename, function (err) {
            if (err !== null) {
                return analyseFailed('Error while copying :' + err);
            } else {
                console.info('-----------------------------------');
                // Check file extension
                switch (extensionOf(filename)) {
                    case 'ipa': { // Unzip .ipa, extract the .mobileprovision, and analyse it
                        var zip = new AdmZip(targetPath),
                            entries = zip.getEntries();
                        for (var i = 0; i < entries.length; ++i) {
                            if (extensionOf(entries[i].entryName) === 'mobileprovision') {
                                zip.extractEntryTo(entries[i].entryName, tmpDir, false, true);
                                return analyseProvisionning(tmpDir + '/' + entries[i].name);
                            }
                        }
                        return analyseFailed('No provisionning found in ' + entries[i].name);
                    }
                    case 'app': { // Read the .app, copy the .mobileprovision, and analyse it
                        var files = fs.readdirSync(targetPath); // We check only at the root of .app
                        for (var i = 0; i < files.length; ++i) {
                            if (extensionOf(files[i]) === 'mobileprovision') {
                                return analyseProvisionning(tmpDir + '/' + files[i]);
                            }
                        }
                        return analyseFailed('Error while copying provisionning :', err);
                    }
                    case 'mobileprovision': { // Just analyse the .mobileprovision
                        return analyseProvisionning(targetPath);
                    }
                    default:
                        alert('FU !');
                        return;
                }
            }
        });
    }

    $ipa_dropzone.ondragenter = function (e) {
        $(this).css('border-color', 'yellow');
        if (e.dataTransfer.files.length > 1) {
            alert('NO');
        }
    }

    $ipa_dropzone.ondragleave = function (e) {
        $(this).css('border-color', 'red');
    }
});

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