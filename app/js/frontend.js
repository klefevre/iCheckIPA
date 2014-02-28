/**
 * Created by Kevin Lefevre on 27/02/2014.
 */

var http = require('http'),
    fs = require('fs-extra'),
    gui = require('nw.gui'),
    os = require('os'),
    url = require('url'),
    AdmZip = require('adm-zip'),
    plist = require('plist'),
    rimraf = require('rimraf'),
    exec = require('child_process').exec;

var win = gui.Window.get();
win.showDevTools();

$(document).ready(function () {
    //Load the settings and start the backend webserver.
    loadSettings();

    $('#tabs-results a').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
    });

    $('#input-group-udid button').click(function (e) {
        if ($(this).hasClass('btn-danger')) {
            console.log('delete');
        } else {
            console.log('add');
        }
    });

    $('#button-settings-delete-cache').click(function (e) {
       fs.exists(process.cwd() + '/../tmp/', function (exist) {
            if (exist) {
                rimraf(process.cwd() + '/../tmp/', function (err) {
                    if (err) { return console.error('Err =', err); }

                    $(this).popover('show');
                });
            } else {
                console.log('already deleted');
            }
        });
    });

    $('#button-settings-save').click(function (e) {
        console.log('save');
        $("#settings").modal('hide');
    });

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

function displayCertificateResults(results) {

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
                console.log('stdout =', stdout);
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
                    return callback(null, tmpDir + '/' + entries[i].name);
                }
            }
            return callback('No provisionning found in ' + entries[i].name, null);
        }
        case 'app': { // Read the .app (only at the root level), and analyse it
            fs.readdir(targetPath, function (err, files) {
                if (err) { return analyseFailed('Error while reading .app : ' + err); }
                for (var i = 0; i < files.length; ++i) {
                    console.log(files[i]);
                    if (extensionOf(files[i]) === 'mobileprovision') {
                        console.log('==> provisionning found')
                        return callback(null, targetPath + '/' + files[i]);
                    }
                }
                return callback('No provisionning found in ' + filename, null);
            });
            break;
        }
        case 'mobileprovision': // Just analyse the .mobileprovision
            return callback(null, targetPath);
        default:
            break;
    }
}

function manageProvisionningDropzone() {
    var $provisionning_dropzone = $('#dropzone')[0];

    $provisionning_dropzone.ondrop = function (e) {
        e.preventDefault();
        resetUI();
        $(this).css('border-color', 'red');

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
                return false;
        }


        // Create tmp directory which should be unique
        if (!fs.existsSync(process.cwd() + '/../tmp/')) {
            fs.mkdirSync(process.cwd() + '/../tmp/');
        }
        var tmpDir = process.cwd() + '/../tmp/' + new Date().getTime() + Math.random();
        fs.mkdirSync(tmpDir);

        // Copy file in tmpDir
        var targetPath = tmpDir + '/' + filename;
        console.log('targetPath =', targetPath);

        fs.copy(srcPath, targetPath, function (err) {
            if (err) { return analyseFailed('Error while copying :' + err); }
            extractProvisionning(filename, targetPath, tmpDir,
                function (err, provisionningPath) {
                    if (err) { return analyseFailed(err); }
                    analyseProvisionning(provisionningPath);
                });
        });
    }

    $provisionning_dropzone.ondragenter = function (e) {
        $(this).css('border-color', 'yellow');
    }

    $provisionning_dropzone.ondragleave = function (e) {
        $(this).css('border-color', 'red');
    }
}

//
// Certificate management
//
function analyseCertificate(pemPath, callback) {
    fs.readFile(pemPath, function (err, data) {
        if (err) { return callback(err, null); }

        console.log('- analyseCertificate --------------------');
        console.log(data);

        var BEGIN_CERTIF = '-----BEGIN CERTIFICATE-----',
            END_CERTIF = '-----END CERTIFICATE-----',
            certArr = substringBetweenStrings(data, BEGIN_CERTIF, END_CERTIF);
        console.log(certArr);

        return callback(null, certArr);
    });
}

function decryptCertificate(certifPath, password, callback) {
    if (certifPath === undefined || certifPath === null) { return analyseFailed('Analyse failed'); }
    if (password === undefined || password === null) { return analyseFailed('Password is required to decrypt a p12'); }

    // TODO: Find a way to NOT use exec -> EVIL. Maybe we may achieve it using crypto, node-forge or something else ?
    var child = exec('openssl pkcs12 -nodes -in ' + certifPath + ' -out ' + certifPath + '.pem' + ' -passin pass:' + password,
        function (error, stdout, stderr) {
            if (error) { return callback(error, null); }
            return callback(null, certifPath + '.pem')
        });
}

function extractCertificate(filename, targetPath, callback) {
    // Check extension's file
    switch (extensionOf(filename)) {
        case 'p12':
            decryptCertificate(targetPath, 'test', function(err, pemPath) {
                return callback(err, pemPath);
            });
            break;
        case 'pem':
            return callback(null, targetPath);
        default:
            return analyseFailed('Bad extension file');
    }
}

function manageCertificateDropzone() {
    var $certif_dropzone = $('#certif_dropzone')[0];

    $certif_dropzone.ondrop = function (e) {
        e.preventDefault();
        $(this).css('border-color', 'red');

        // Get srcPath and filename
        var srcPath = e.dataTransfer.files[0].path;
        srcPath = srcPath.replace(/\\/g, "/");
        var filename = srcPath.split('/')[srcPath.split('/').length - 1];
        console.log('srcPath =', e.dataTransfer.files[0].path);
        console.log('filename =', filename);

        // Check extension's file
        switch (extensionOf(filename)) {
            case 'p12':
            case 'pem':
                break;
            default:
                return analyseFailed('Bad extension file');
        }

        // Create tmp directory which should be unique
        if (!fs.existsSync(process.cwd() + '/../tmp/')) {
            fs.mkdirSync(process.cwd() + '/../tmp/');
        }
        var tmpDir = process.cwd() + '/../tmp/' + new Date().getTime() + Math.random();
        fs.mkdirSync(tmpDir);

        // Copy file in tmpDir
        var targetPath = tmpDir + '/' + filename;
        console.log('targetPath =', targetPath);

        fs.copy(srcPath, targetPath, function (err) {
            if (err) { return analyseFailed('Error while copying ' + filename + ' : ' + err); }
            extractCertificate(filename, targetPath, function(err, pemPath) {
                return analyseCertificate(pemPath, function (err, certArr) {
                   displayCertificateResults(certArr);
                });
            });
        });
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

// Extract substrings between two string e.g. "TOTOTITITATA", "TOTO", "TATA" = [TITI]
function substringBetweenStrings(str, firstStr, secondStr) {
    var retArr = new Array(),
        tmpStr = str,
        i = 0,
        beginIdx,
        endIdx;

    while ((beginIdx = tmpStr.indexOf(firstStr)) > -1 &&
        ((endIdx = tmpStr.indexOf(secondStr)) > -1)) {
        retArr[i++] = tmpStr.substring(beginIdx + firstStr.length + 1, endIdx - 1);
        tmpStr = tmpStr.substring(endIdx + secondStr.length, tmpStr.length);
    }
    return retArr;
}
