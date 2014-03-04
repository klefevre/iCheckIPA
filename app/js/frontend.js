/**
 * (The MIT License)
 *
 * Copyright (c) 2014 Kevin Lefevre <contact@kevinlefevre.com>
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated
 * documentation files (the 'Software'), to deal in the Software
 * without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice
 * shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var Certificate = {},
    Provisionning = {};

$(window).load(function () {
    //Load the settings and start the backend webserver.
    loadSettings();

    $('#tabs-results a').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
    });

    $('#button-settings-delete-cache').click(function (e) {
//       fs.exists(process.cwd() + '/../tmp/', function (exist) {
//            if (exist) {
//                rimraf(process.cwd() + '/../tmp/', function (err) {
//                    if (err) { return console.error('Err =', err); }
//
//                    $(this).popover('show');
//                });
//            } else {
//                console.log('already deleted');
//            }
//        });
    });

    $('#button-settings-save').click(function (e) {
        $("#settings").modal('hide');
    });

//    manageProvisionningDropzone();
//    manageCertificateDropzone();

    $('.dropzone').on('dragenter dragleave drop', function (e) {
        e.stopPropagation();
        e.preventDefault();

        $this = $(this);

        switch (e.type) {
            case 'dragenter':
                console.log('e =', e);
                console.log('e.dataTransfer =', e.dataTransfer);
                return;
                if (!(e.originalEvent.dataTransfer.files.length == 1 && e.originalEvent.dataTransfer.files[0].types == 'Files')) {
                    console.warning('Only 1 file could be accepted at once');
                    return;
                }
                $this.addClass('hover');
                break;
            case 'dragleave':
                $this.removeClass('hover');
                break;
            case 'drop':
                $this.removeClass('hover');

                // Get srcPath and filename
                var srcPath = e.originalEvent.dataTransfer.files[0].path;
                srcPath = srcPath.replace(/\\/g, '/');
                var filename = srcPath.split('/')[srcPath.split('/').length - 1];
                console.log('srcPath =', e.originalEvent.dataTransfer.files[0].path);
                console.log('filename =', filename);

                switch ($this.attr('id')) {
                    case 'dropzone':
                        parseProvisionning(srcPath, function (file, err) {
                            if (err) {
                                analyseFailed(err);
                                return;
                            }

                            console.log(file);
                        });
                        break;
                    case 'certif_dropzone':
                        parseCertificate(srcPath, function (file, err) {
                            if (err) {
                                analyseFailed(err);
                                return;
                            }

                            console.log(file);
                        });
                        break;
                }
                break;
        }
    });
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
        for (var i = 0; i < obj.length; ++i) {
            $list.append($('<li class="list-group-item">').append(obj[i]));
        }
    }
}

function analyseFailed(err) {
    alert(err);
}

function manageProvisionningDropzone() {

//    $provisionning_dropzone.ondrop = function (e) {
//        e.preventDefault();
//        resetUI();
//        $(this).css('border-color', 'red');
//
//        // Get srcPath and filename
//        var srcPath = e.dataTransfer.files[0].path;
//        srcPath = srcPath.replace(/\\/g, '/');
//        var filename = srcPath.split('/')[srcPath.split('/').length - 1];
//        console.log('srcPath =', e.dataTransfer.files[0].path);
//        console.log('filename =', filename);
//
//        // Check extension's file
//        switch (extensionOf(filename)) {
//            case 'ipa':
//            case 'app':
//            case 'mobileprovision':
//                break;
//            default:
//                return false;
//        }
//
//
//        // Create tmp directory which should be unique
//        if (!fs.existsSync(process.cwd() + '/../tmp/')) {
//            fs.mkdirSync(process.cwd() + '/../tmp/');
//        }
//        var tmpDir = process.cwd() + '/../tmp/' + new Date().getTime() + Math.random();
//        fs.mkdirSync(tmpDir);
//
//        // Copy file in tmpDir
//        var targetPath = tmpDir + '/' + filename;
//        console.log('targetPath =', targetPath);
//
//        fs.copy(srcPath, targetPath, function (err) {
//            if (err) { return analyseFailed('Error while copying :' + err); }
//            extractProvisionning(filename, targetPath, tmpDir,
//                function (err, provisionningPath) {
//                    if (err) { return analyseFailed(err); }
//                    analyseProvisionning(provisionningPath);
//                });
//        });
//    }
//
//    $provisionning_dropzone.ondragenter = function (e) {
//        $(this).css('border-color', 'yellow');
//    }
//
//    $provisionning_dropzone.ondragleave = function (e) {
//        $(this).css('border-color', 'red');
//    }
}

function manageCertificateDropzone() {
//    var $certif_dropzone = $('#certif_dropzone')[0];
//
//    $certif_dropzone.ondrop = function (e) {
//        e.preventDefault();
//        $(this).css('border-color', 'red');
//
//        // Get srcPath and filename
//        var srcPath = e.dataTransfer.files[0].path;
//        srcPath = srcPath.replace(/\\/g, "/");
//        var filename = srcPath.split('/')[srcPath.split('/').length - 1];
//        console.log('srcPath =', e.dataTransfer.files[0].path);
//        console.log('filename =', filename);
//
//        // Check extension's file
//        switch (extensionOf(filename)) {
//            case 'p12':
//            case 'pem':
//                break;
//            default:
//                return analyseFailed('Bad extension file');
//        }
//
//        // Create tmp directory which should be unique
//        if (!fs.existsSync(process.cwd() + '/../tmp/')) {
//            fs.mkdirSync(process.cwd() + '/../tmp/');
//        }
//        var tmpDir = process.cwd() + '/../tmp/' + new Date().getTime() + Math.random();
//        fs.mkdirSync(tmpDir);
//
//        // Copy file in tmpDir
//        var targetPath = tmpDir + '/' + filename;
//        console.log('targetPath =', targetPath);
//
//        fs.copy(srcPath, targetPath, function (err) {
//            if (err) { return analyseFailed('Error while copying ' + filename + ' : ' + err); }
//            extractCertificate(filename, targetPath, function(err, pemPath) {
//                return analyseCertificate(pemPath, function (err, certArr) {
//                   displayCertificateResults(certArr);
//                });
//            });
//        });
//    }
//    $certif_dropzone.ondragenter = function (e) {
//        $(this).css('border-color', 'yellow');
//        if (e.dataTransfer.files.length > 1) {
//            alert('NO');
//        }
//    }
//    $certif_dropzone.ondragleave = function (e) {
//        $(this).css('border-color', 'red');
//    }
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
