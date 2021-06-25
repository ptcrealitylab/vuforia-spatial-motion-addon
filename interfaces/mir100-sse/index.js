/**
 * @preserve
 *
 *                                     .,,,;;,'''..
 *                                 .'','...     ..',,,.
 *                               .,,,,,,',,',;;:;,.  .,l,
 *                              .,',.     ...     ,;,   :l.
 *                             ':;.    .'.:do;;.    .c   ol;'.
 *      ';;'                   ;.;    ', .dkl';,    .c   :; .'.',::,,'''.
 *     ',,;;;,.                ; .,'     .'''.    .'.   .d;''.''''.
 *    .oxddl;::,,.             ',  .'''.   .... .'.   ,:;..
 *     .'cOX0OOkdoc.            .,'.   .. .....     'lc.
 *    .:;,,::co0XOko'              ....''..'.'''''''.
 *    .dxk0KKdc:cdOXKl............. .. ..,c....
 *     .',lxOOxl:'':xkl,',......'....    ,'.
 *          .';:oo:...                        .
 *               .cd,    ╔═╗┌─┐┬─┐┬  ┬┌─┐┬─┐   .
 *                 .l;   ╚═╗├┤ ├┬┘└┐┌┘├┤ ├┬┘   '
 *                   'l. ╚═╝└─┘┴└─ └┘ └─┘┴└─  '.
 *                    .o.                   ...
 *                     .''''','.;:''.........
 *                          .'  .l
 *                         .:.   l'
 *                        .:.    .l.
 *                       .x:      :k;,.
 *                       cxlc;    cdc,,;;.
 *                      'l :..   .c  ,
 *                      o.
 *                     .,
 *
 *             ╦ ╦┬ ┬┌┐ ┬─┐┬┌┬┐  ╔═╗┌┐  ┬┌─┐┌─┐┌┬┐┌─┐
 *             ╠═╣└┬┘├┴┐├┬┘│ ││  ║ ║├┴┐ │├┤ │   │ └─┐
 *             ╩ ╩ ┴ └─┘┴└─┴─┴┘  ╚═╝└─┘└┘└─┘└─┘ ┴ └─┘
 *
 * Created by Anna Fuste on 03/20/19.
 *
 * Copyright (c) 2015 Valentin Heun
 *
 * All ascii characters above must be included in any redistribution.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
var server = require('../../../../libraries/hardwareInterfaces');
var nodeUtilities = require('../../../../libraries/nodeUtilities.js');
var settings = server.loadHardwareInterface(__dirname);

const { WebSocketInterface } = require('./websocketInterface');
const { RestAPIInterface } = require('./restapiInterface');
const { RestAPIServer } = require('./restapiserver');
const { CustomMaths } = require('./customMaths');

exports.enabled = settings('enabled');
exports.configurable = true;

let objectName = 'MIR';
let hostIP = '10.10.10.30';
let port = 39320;
//let port = 9090;

let worldObjectId = '';

let isRobotConnected = false;
let enableMIRConnection = true;     // For debugging purposes, deactivate from browser if you just want to develop on the interface without the robot connection

if (exports.enabled) {               // These settings will be exposed to the webFrontend to potentially be modified

    setup();

    console.log('mir100-sse: Settings loaded: ', objectName, hostIP, port, isRobotConnected, enableMIRConnection);

    server.setHardwareInterfaceSettings('mir100-sse', exports.settings, null, function(successful, error) {
        if (error) {
            console.log('mir100-sse: error persisting settings', error);
        }
    });
    
    function setup() {
        
        /**
         * These settings will be exposed to the webFrontend to potentially be modified
         */
        exports.settings = {
            robotIp: {
                value: settings('robotIp', '10.10.10.30'),
                type: 'text',
                disabled: false,
                default: '10.10.10.30',
                helpText: 'The IP address of the MIR100 you want to connect to.'
            },
            robotPort: {
                value: settings('robotPort', 39320),
                type: 'number',
                disabled: false,
                default: 39320,
                helpText: 'The port of the MIR100 Gateway.'
            },
            objectName: {
                value: settings('objectName', 'MIR'),
                type: 'text',
                disabled: false,
                default: 'MIR',
                helpText: 'The name of the object that connects to this hardware interface.'
            },
            isRobotConnected: {
                value: settings('isRobotConnected', false),
                type: 'boolean',                                                // Variable type
                disabled: true,                                                 // If this variable should be editable or not
                default: false,                                                 // Default value assigned to this variable
                helpText: 'Is the robot currently connected?'                   // Text that will appear on the web frontend
            },
            enableMIRConnection: {
                value: settings('enableMIRConnection', true),                   // Variable type
                type: 'boolean',                                                // Default value assigned to this variable
                disabled: false,                                                // If this variable should be editable or not
                default: true,
                helpText: 'Do you want to enable the connection of the robot?'  // Text that will appear on the web frontend
            }
        };
    }
    
    objectName = exports.settings.objectName.value;
    hostIP = exports.settings.robotIp.value;
    port = parseInt(exports.settings.robotPort.value);
    enableMIRConnection = exports.settings.enableMIRConnection.value;
    isRobotConnected = exports.settings.isRobotConnected.value;

    server.addEventListener('reset', function() {   // reload the settings from settings.json when you get a 'reset' message
        settings = server.loadHardwareInterface(__dirname);
        setup();

        console.log('mir100-sse: Settings loaded: ', objectName, hostIP, port, isRobotConnected, enableMIRConnection);
    });
}

// Robot Websocket & REST variables
let websocket, restapi, serverRest = null;
let maths = null;

// Robot REST API address and endpoints
const restAddress = "http://" + hostIP + "/api/v2.0.0";
const endpoints = {
    missions: "/missions",
    status: "/status",
    maps: "/maps",
    positions: "/positions"
};

let mir_current_state = 3;                  // MIR starts with state 3: READY!
let mir_mission_interrupted = false;
let moveToCoordinateGUID = "";              // Mission GUID needed for REST calls
let inMotion = false;                       // When robot is moving
let mirStatus = {};                         // MIR STATUS
let arStatus = {};                          // AR STATUS

let pathData = [];                          // List of paths with checkpoints
let activeCheckpointName = null;            // Current active checkpoint

let pathPointTriggered = null;
let currentIndexInPath = null;

const groundPlaneScaleFactor = 1000;        // In mm
let lastPositionAR = {x: 0, y: 0};          // Last position of the robot in AR
let lastDirectionAR = {x: 0, y: 0};         // Last direction of the robot in AR
let currentPositionMIR = {x: 0, y: 0};      // Current position of the robot in her MIR map
let currentOrientationMIR = 0;              // Current orientation of the robot in her MIR map
let initPositionMIR = {x: 0, y: 0};         // Initial position of the robot in her MIR map
let initOrientationMIR = 0;                 // Initial orientation of the robot in her MIR map when the user tracks it with the phone
let initOrientationAR = 0;                  // Initial orientation of the robot in AR when the user tracks it with the phone
let initialSync = false;

function startHardwareInterface() {
    
    console.log('mir100-sse: Start Robotic Addon - Allow robot Connection? ', enableMIRConnection);

    server.enableDeveloperUI(true);
    server.removeAllNodes(objectName, 'kineticAR'); // We remove all existing nodes from the Frame
    
    maths = new CustomMaths();

    console.log('mir100-sse: Setting default tool to motion');
    server.setTool(objectName, 'kineticAR', 'mission', __dirname);

    server.addReadListener(objectName, 'kineticAR', 'mission', function(data) {            // Add listener to node
        //console.log('Data from Mission Node', data);

        //console.log(data);
        if (data.mode === 'c' && data.unit === 'path') {
            parseData(data);
        }

    });

    server.addPublicDataListener(objectName, 'kineticAR', 'storage', 'calibration', function (data) {

        console.log('received data from mission tool: ', data);
        
        arStatus = data;

        lastPositionAR.x = data.position.x/groundPlaneScaleFactor;
        lastPositionAR.y = data.position.y/groundPlaneScaleFactor;

        lastDirectionAR.x = data.direction.x;
        lastDirectionAR.y = data.direction.y;

        initOrientationMIR = currentOrientationMIR;                         // Get orientation at this moment in time
        initOrientationAR =  (-1) * maths.signed_angle([1,0], [lastDirectionAR.x, lastDirectionAR.y]) * 180 / Math.PI;
        initPositionMIR.x = currentPositionMIR.x;
        initPositionMIR.y = currentPositionMIR.y;
        initialSync = true;

        console.log("LAST POSITION AR: ", lastPositionAR);              //       { x: -332.3420, y: 482.1173, z: 1749.54107 }
        console.log("LAST DIRECTION AR: ", lastDirectionAR);            //       { x: -0.84, y: -0.00424 }
        console.log('initOrientation: ', initOrientationAR);

    });


    if (enableMIRConnection) connectWebsocket();
    updateEvery(0, 100);
}

function parseData(data) {
    worldObjectId = data.value.worldObject;
    let pathEnvelopeId = data.value.address.tool;
    let pathMode = data.value.mode; // "PATH" (in future could be "OPTIONS", "NAVIGATION", etc)
    let path = data.value.path;

    pathData = [];

    path.forEach(function (pathPoint) {
        let pathPointId = pathPoint.address.tool;
        let pathPointObjectId = pathPoint.address.object;

        pathPoint.points.forEach(function (point) {
            
            if (point.matrix !== null){     // Prevent server from crashing if no data
                pathData.push({
                    id: pathPointId,
                    objectId: pathPointObjectId,
                    speed: point.speed,
                    orientation: 0,
                    x: point.matrix[12] / point.matrix[15],
                    y: (-1)*point.matrix[13] / point.matrix[15],
                    z: point.matrix[14] / point.matrix[15]
                });
            }
        });
    });

    /* Coordinate sync:
    groundplane x = pathPoint.x
    groundplane z = - pathPoint.y */

    console.log('pathData: ', pathData);

    path.forEach(function (pathPoint) {
        nodeUtilities.searchNodeByType('node', pathPoint.address.object, pathPoint.address.tool, pathPoint.address.node, addNodeListener);
    });
}

// Request Information to the MIR100
function restRequest(endpoint){
    return restapi.getData(restAddress + endpoint);
}

function addNodeListener(pathPointObjectKey, pathPointToolKey, pathPointNodeKey) {

    console.log('search node: ', pathPointObjectKey, pathPointToolKey, pathPointNodeKey);

    // Find the names instead of IDs

    let pathPointObjectName = server.getObjectNameFromObjectId(pathPointObjectKey);
    let pathPointToolName = server.getToolNameFromToolId(pathPointObjectKey, pathPointToolKey);
    let pathPointNodeName = server.getNodeNameFromNodeId(pathPointObjectKey, pathPointToolKey, pathPointNodeKey);

    console.log('addReadListener: ', pathPointObjectName, pathPointToolName, pathPointNodeName);

    server.addReadListener(pathPointObjectName, pathPointToolName, pathPointNodeName, function (data) {

        console.log('path point callback: ', data);

        let index = pathData.indexOf(pathData.find(pd => pd.id === pathPointToolKey));

        console.log('PathPoint triggered in path: ', index);

        if (data.value === 1){

            pathPointTriggered = pathPointToolName;
            currentIndexInPath = index;

            // The node for this Path Point has been activated
            // Send robot to this Path Point
            // Compute next boost movement

            let missionData = computeMIRCoordinatesTo(pathData[index].x, pathData[index].z, pathData[index].orientation);

            console.log("missionData: ", missionData);
            
            let newAddress = restAddress + "/mission_queue";

            if (enableMIRConnection) {
                restapi.postData(newAddress, missionData)
                    .then(res => console.log(res))          // JSON-string from `response.json()` call
                    .catch(error => console.error(error));
            }

            inMotion = true;

        } else if (data.value === 0) {
            
            console.log('0 received in pathpoint: ', pathPointToolName);

            // The node for this Path Point has been deactivated
            if (pathPointTriggered === pathPointToolName) {
                
                console.log('The node for this Path Point has been deactivated');

                // We reached this path point, we need to go to the next path point in path

                if (index + 1 < pathData.length){                      // Next checkpoint in same path

                    // We need to find the id for the node on the next path point to trigger it
                    nodeUtilities.searchNodeByType('node', pathData[index + 1].objectId, pathData[index + 1].id, null, function (objectKey, toolKey, newNodeKey){

                        console.log('Found node in next pathpoint: ', objectKey, toolKey, newNodeKey);

                        let objectName = server.getObjectNameFromObjectId(objectKey);
                        let toolName = server.getToolNameFromToolId(objectKey, toolKey);
                        let newNodeName = server.getNodeNameFromNodeId(objectKey, toolKey, newNodeKey);

                        server.write(objectName, toolName, newNodeName, 1);
                    });

                } else {    // We reached end of path

                    console.log('REACHED END OF PATH');

                    pathPointTriggered = null;
                    currentIndexInPath = null;

                    // Do something here after end of path reached...

                }
            }
        }
    });
}

function computeMIRCoordinatesTo(newCheckpointX, newCheckpointY, checkpointOrientation){
    
    //console.log('Compute new coordinates: ', newCheckpointX, newCheckpointY, checkpointOrientation);

    let lastDirectionTo = [lastDirectionAR.x, lastDirectionAR.y];
    
    //console.log('Last Direction To: ', lastDirectionTo);

    let from = [lastPositionAR.x, lastPositionAR.y];
    let to = [newCheckpointX / groundPlaneScaleFactor, newCheckpointY / groundPlaneScaleFactor];
    
    //console.log('FROM: ', from);
    //console.log('TO: ', to);

    const newDistance = maths.distance(from, to);                                   // Distance that the robot has to travel to get to the next point

    let newDirectionVector = [to[0] - from[0], to[1] - from[1]];                    // newDirection = to - from

    //console.log('New Direction Vector: ', newDirectionVector);
    
    let angleBetween = maths.signed_angle(newDirectionVector, lastDirectionTo);     // Angle between direction vectors
    
    const newDirectionDeg = maths.radians_to_degrees(angleBetween);                 // Angle that the robot has to turn to go to next coordinate in deg

    //console.log('newDirectionDeg: ', newDirectionDeg);
    
    currentOrientationMIR = currentOrientationMIR + newDirectionDeg;                // Angle in the MIR Coordinate system
    
    //console.log('Adding new direction to current orientation MIR: ', currentOrientationMIR);

    currentPositionMIR.x += newDistance * Math.cos(maths.degrees_to_radians(currentOrientationMIR));
    currentPositionMIR.y += newDistance * Math.sin(maths.degrees_to_radians(currentOrientationMIR));

    //console.log('adding new distance to current position MIR: ', currentPositionMIR);
    
    let angleDifferenceAR = initOrientationAR + checkpointOrientation;
    let newOrientation = initOrientationMIR - angleDifferenceAR;

    // Normalize to range range (-180, 180]
    if (newOrientation > 180)        { newOrientation -= 360; }
    else if (newOrientation <= -180) { newOrientation += 360; }
    
    //console.log('newOrientation: ', newOrientation);

    let dataObj = {
        "mission_id": moveToCoordinateGUID,
        "parameters":[{"input_name":"positionX","value": currentPositionMIR.x},
            {"input_name":"positionY","value": currentPositionMIR.y},
            {"input_name":"orientation","value": newOrientation}]
    };

    currentOrientationMIR = newOrientation;
    lastDirectionAR.x = Math.cos(maths.degrees_to_radians(checkpointOrientation));
    lastDirectionAR.y = Math.sin(maths.degrees_to_radians(checkpointOrientation));
    lastPositionAR.x = to[0];
    lastPositionAR.y = to[1];

    return dataObj;
}

function processStatus(data) {

    if (data !== undefined){
        mirStatus = data['position'];

        if (mirStatus !== undefined){
            currentPositionMIR.x = mirStatus['x'];
            currentPositionMIR.y = mirStatus['y'];
            currentOrientationMIR = mirStatus['orientation'];

            // Send info to rest server for others to access it.
            serverRest.RobotStatus = mirStatus;

            /*console.log("********************************");
            console.log("   -   -   -   ROBOT NAME: " + data['robot_name']);
            console.log("   -   -   -   ROBOT POS: ", dataStatus);
            console.log("   -   -   -   mission_queue_id: " + data['mission_queue_id']);
            console.log("   -   -   -   mission_queue_url: " + data['mission_queue_url']);
            console.log("   -   -   -   mission_text: " + data['mission_text']);
            console.log("   -   -   -   mode_id: " + data['mode_id']);
            console.log("   -   -   -   state_id: " + data['state_id']);
            console.log("   -   -   -   state_text: " + data['state_text']);*/

            const state_id = parseInt(data['state_id']);

            switch(state_id){
            case 3:
                if (mir_current_state !== 3){

                    if (mir_mission_interrupted){

                        console.log('mir100-sse: All missions stopped due to interruption');

                        mir_mission_interrupted = false;

                        mir_current_state = 3;

                        inMotion = false;

                    } else {

                        console.log("mir100-sse: Robot changed state to ready.");
                        inMotion = false;

                        if (pathPointTriggered !== null){     // MIR has finished mission. Send a 0 to current checkpoint

                            console.log('pathPointTriggered: ', pathPointTriggered);
                            console.log('worldobjectId and tool id: ', worldObjectId, pathData[currentIndexInPath].id);

                            nodeUtilities.searchNodeByType('node', pathData[currentIndexInPath].objectId, pathData[currentIndexInPath].id, null, function (objectKey, toolKey, newNodeKey){

                                console.log('mir100-sse: Node id: ', newNodeKey);

                                let objectName = server.getObjectNameFromObjectId(objectKey);
                                let toolName = server.getToolNameFromToolId(objectKey, toolKey);
                                let newNodeName = server.getNodeNameFromNodeId(objectKey, toolKey, newNodeKey);
                                console.log('mir100-sse: Node: ', objectName, toolName, newNodeName);

                                console.log('mir100-sse: Set current path point to 0');

                                // Set node to 0
                                server.write(objectName, toolName, newNodeName, 0);

                                console.log('mir100-sse: done');
                            });
                        } else {
                            console.log("mir100-sse: No checkpoint active. Active checkpoint is NULL");
                        }

                        mir_current_state = 3;
                    }
                }
                break;
            case 5:     // EXECUTING
                if (mir_current_state !== 5){
                    console.log("mir100-sse: CHANGED STATE TO EXECUTING!");
                    mir_current_state = 5;
                    inMotion = true;        // When robot starts moving
                }
                break;

            case 10:    // emergency stop
                console.log("mir100-sse: EMERGENCY STOP");
                break;

            case 11:    // manual control
                console.log("mir100-sse: MANUAL CONTROL");
                break;
            default:
                break;
            }
        }
    }
}

/**
 * @desc Once REST responds with data from missions, process the data and keep the GUID
 */
function processMissions(data){
    for(var i = 0; i < data.length; i++) {
        var obj = data[i];
        if (obj.name === 'Move To Coordinate') moveToCoordinateGUID = obj.guid;
    }
}


/**
 * @desc This method will send the position of the robot in AR in realtime to the tool
 */
function sendRealtimeRobotPosition(){

    let _currentOrientation_MIR = websocket.currentYaw();                       // Orientation of the robot at this frame in degrees (from WebSocket)
    let _currentPosition_MIR = websocket.currentRobotPosition;                  // Position of the robot at this frame

    let newARPosition = positionFromMIRToAR(_currentPosition_MIR, _currentOrientation_MIR);

    //console.log('Send robot AR pos to path: ', newARPosition);
    server.writePublicData(objectName, 'path', 'realtimepos', 'ARposition', newARPosition);    // Send newARPosition to frame
}


/**
 * @desc Compute the position from the MIR robot map into the AR coordinate system
 */
function positionFromMIRToAR(newPosition, newDirectionAngle)
{
    let newARPosition = {x:0, y:0, z:0};

    if (newDirectionAngle < 0) newDirectionAngle += 360;                                                    // newDirectionAngle between 0 - 360

    let initialAngleMIR = initOrientationMIR;
    if (initialAngleMIR < 0) initialAngleMIR += 360;                                                        // initialAngleMIR between 0 - 360
    let initialRobotDirectionVectorMIR = [Math.cos(maths.degrees_to_radians(initialAngleMIR)),              // MIR space
        Math.sin(maths.degrees_to_radians(initialAngleMIR))];

    let from = [initPositionMIR.x, initPositionMIR.y];
    let to = [newPosition.x, newPosition.y];

    let newDistance = maths.distance(from, to);                                                             // Distance between points

    let newDir = [to[0] - from[0], to[1] - from[1]];                                                        // newDirection = to - from
    let newDirectionRad = maths.signed_angle(initialRobotDirectionVectorMIR, newDir);                       // Angle between initial direction and new direction

    let angleDifference = newDirectionAngle - initialAngleMIR;                                              // Angle difference between current and initial MIR orientation

    let _initialOrientation_AR = maths.signed_angle([arStatus.direction.x, arStatus.direction.y], [1,0]);   // Initial AR direction

    if (_initialOrientation_AR < 0) _initialOrientation_AR += 2*Math.PI;                                    // _initialOrientation_AR between 0 - 360

    let newARAngle = maths.radians_to_degrees(_initialOrientation_AR) + angleDifference;

    let newAngleDeg = maths.radians_to_degrees(_initialOrientation_AR) + maths.radians_to_degrees(newDirectionRad);

    newARPosition.x = (arStatus.position.x/groundPlaneScaleFactor) + (newDistance * Math.cos(maths.degrees_to_radians(newAngleDeg)));
    newARPosition.y = - ((- arStatus.position.y/groundPlaneScaleFactor) + (newDistance * Math.sin(maths.degrees_to_radians(newAngleDeg))));
    newARPosition.z = maths.degrees_to_radians(newARAngle);

    return newARPosition;
}

/**
 * @desc Connect to websocket. If it fails, try to connect again. If success, continue with rest api requests
 * REST requests will only be triggered when WebSocket connection is successful
 */
function connectWebsocket(){

    websocket = new WebSocketInterface(hostIP, port);

    websocket.eventEmitter.on('ok', function(){
        startRESTRequests();                                                 // Start REST requests
        exports.settings.isRobotConnected.value = true;
        server.pushSettingsToGui('mir100-sse', exports.settings);   // Update GUI in browser
    }, false);
    websocket.eventEmitter.on('ko', function(){
        connectWebsocket();                                                  // Try again until success
        exports.settings.isRobotConnected.value = false;
        server.pushSettingsToGui('mir100-sse', exports.settings);   // Update GUI in browser
    }, false);
}

/**
 * @desc Initial REST requests calls for missions and status
 */
function startRESTRequests(){

    restapi = new RestAPIInterface(hostIP);
    serverRest = new RestAPIServer(3030);       // Create server for others to access robot data

    restRequest(endpoints.missions).then(function (data) {

        processMissions(data);
        requestStatus();

    }).catch(error => console.warn('\x1b[36m%s\x1b[0m', "mir100-sse: Could not process Missions. REST request failed. ☹ "));
}

/**
 * @desc Recursively ask for status
 */
function requestStatus(){
    restRequest(endpoints.status).then(function (data){
        processStatus(data);
        requestStatus();    // call restRequest again
    }).catch(error => console.error(error));
}

/**
 * @desc UPDATE method
 */
function updateEvery(i, time) {
    setTimeout(() => {
        if (enableMIRConnection && initialSync) sendRealtimeRobotPosition();
        updateEvery(++i, time);
    }, time)
}

server.addEventListener("initialize", function () {
    if (exports.enabled) startHardwareInterface();
});
server.addEventListener("shutdown", function () {
});


