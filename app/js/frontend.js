var http = require('http'),
    fs = require('fs-extra'),
    gui = require('nw.gui'),
    os = require('os'),
    url = require('url'),
    AdmZip = require('adm-zip'),
    plist = require('plist'),
    exec = require('child_process').exec;

var win = gui.Window.get();
win.showDevTools();

$(document).ready(function() {
    //Load the settings and start the backend webserver.
    loadSettings();

    $('#panel-results').css('visibility', 'hidden');

    manageProvisionningDropzone();
    manageCertificateDropzone();
});

//
// UI Management
//
function resetUI() {
    $('#panel-results').css('visibility', 'hidden');
    $('#list-entitlements').empty();
    $('#list-udid').empty();
}

function displayResults(results) {
    var $list;
    var obj;
    var text;

    $('#panel-results').css('visibility', 'visible');

    // Entitlements
    obj = results['Entitlements'];
    $list = $('#list-entitlements');

    // Debug
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

//
// Provisionning management
//
function analyseProvisionning(path) {
    console.info('----------------------------------');
    console.info('Analysing provisionning at', path);

    if (path === undefined || path === null) { return analyseFailed('Analyse failed'); }

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

function extractProvisionning(filename, targetPath, tmpDir, callback) {
    switch (extensionOf(filename)) {
        case 'ipa': { // Unzip .ipa, extract the .mobileprovision, and analyse it
            var zip = new AdmZip(targetPath),
                entries = zip.getEntries();
            for (var i = 0; i < entries.length; ++i) {
                if (extensionOf(entries[i].entryName) === 'mobileprovision') {
                    zip.extractEntryTo(entries[i].entryName, tmpDir, false, true);
                    return callback(tmpDir + '/' + entries[i].name);
                }
            }
            return analyseFailed('No provisionning found in ' + entries[i].name);
        }
        case 'app': { // Read the .app (only at the root level), and analyse it
            return fs.readdir(targetPath, function (err, files) {
                if (err) { return analyseFailed('Error while reading .app : ' + err); }
                for (var i = 0; i < files.length; ++i) {
                    console.log(files[i]);
                    if (extensionOf(files[i]) === 'mobileprovision') {
                        return callback(targetPath + '/' + files[i]);
                    }
                }
                return analyseFailed('No provisionning found in ' + filename);
            });
        }
        case 'mobileprovision': // Just analyse the .mobileprovision
            return callback(targetPath);
        default:
            break;
    }
}

function manageProvisionningDropzone() {
    var $ipa_dropzone = $('#dropzone')[0];

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
        var tmpDir = process.cwd() + '../tmp/' + new Date().getTime() + Math.random();
        fs.mkdirSync(tmpDir);

        // Copy file in tmpDir
        var targetPath = tmpDir + '/' + filename;
        console.log('targetPath =', targetPath);

        fs.copy(srcPath, targetPath, function (err) {
            if (err) { return analyseFailed('Error while copying :' + err); }
            extractProvisionning(filename, targetPath, tmpDir, function (provisionningPath) {
                analyseProvisionning(provisionningPath);
            });
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
}

//
// Certificate management
//
function manageCertificateDropzone() {
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
}

//
// Settings management
//
// Load settings function.
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

// A function for extracting settings.
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

//
// Helper
//
// Extract extension of a filename e.g. blabla.zip => zip
function extensionOf(filename) {
    return filename.substr((~-filename.lastIndexOf(".") >>> 0) + 2);
}
