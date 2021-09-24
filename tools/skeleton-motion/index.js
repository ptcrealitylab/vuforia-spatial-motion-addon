/* global THREE, SpatialInterface, window, realGl, gl, proxies, document, EnvelopeContents, io, spatialObject */
const ipPort = '10.10.10.145:31337';

let socket;
let doUpdateSensorDescription = true;

let script = document.createElement('script');
script.src = `http://${ipPort}/socket.io/socket.io.js`;
script.setAttribute('async', 'true');
script.type = 'text/javascript';

let worldId;
const factor = 1000;
let pose;
let poseJointsSpheres = [];
let initTimer = 0;
let skelGroup = new THREE.Group();
let globalSpeed = 0;
let playPauseButton;

const POSE_JOINTS = [
    {id: 'JOINT_PELVIS', index: 0, nodeScreenX: -243, nodeScreenY: -10},
    {id: 'JOINT_SPINE_NAVEL', index: 1, nodeScreenX: -243, nodeScreenY: -50},
    {id: 'JOINT_SPINE_CHEST', index: 2, nodeScreenX: -243, nodeScreenY: -100},
    {id: 'JOINT_NECK', index: 3, nodeScreenX: -243, nodeScreenY: -140},
    //{id: 'JOINT_CLAVICLE_LEFT', index: 4, nodeScreenX: 0, nodeScreenY: 0},
    {id: 'JOINT_SHOULDER_LEFT', index: 5, nodeScreenX: -203, nodeScreenY: -120},
    {id: 'JOINT_ELBOW_LEFT', index: 6, nodeScreenX: -193, nodeScreenY: -50},
    //{id: 'JOINT_WRIST_LEFT', index: 7, nodeScreenX: -172, nodeScreenY: -10},
    {id: 'JOINT_HAND_LEFT', index: 8, nodeScreenX: -172, nodeScreenY: 10},
    //{id: 'JOINT_HANDTIP_LEFT', index: 9, nodeScreenX: 0, nodeScreenY: 0},
    //{id: 'JOINT_THUMB_LEFT', index: 10, nodeScreenX: 0, nodeScreenY: 0},
    //{id: 'JOINT_CLAVICLE_RIGHT', index: 11, nodeScreenX: 0, nodeScreenY: 0},
    {id: 'JOINT_SHOULDER_RIGHT', index: 12, nodeScreenX: -283, nodeScreenY: -120},
    {id: 'JOINT_ELBOW_RIGHT', index: 13, nodeScreenX: -293, nodeScreenY: -50},
    //{id: 'JOINT_WRIST_RIGHT', index: 14, nodeScreenX: -310, nodeScreenY: -10},
    {id: 'JOINT_HAND_RIGHT', index: 15, nodeScreenX: -310, nodeScreenY: 10},
    //{id: 'JOINT_HANDTIP_RIGHT', index: 16, nodeScreenX: 0, nodeScreenY: 0},
    //{id: 'JOINT_THUMB_RIGHT', index: 17, nodeScreenX: 0, nodeScreenY: 0},
    {id: 'JOINT_HIP_LEFT', index: 18, nodeScreenX: -213, nodeScreenY: 10},
    {id: 'JOINT_KNEE_LEFT', index: 19, nodeScreenX: -223, nodeScreenY: 80},
    //{id: 'JOINT_ANKLE_LEFT', index: 20, nodeScreenX: -223, nodeScreenY: 160},
    {id: 'JOINT_FOOT_LEFT', index: 21, nodeScreenX: -223, nodeScreenY: 170},
    {id: 'JOINT_HIP_RIGHT', index: 22, nodeScreenX: -273, nodeScreenY: 10},
    {id: 'JOINT_KNEE_RIGHT', index: 23, nodeScreenX: -263, nodeScreenY: 80},
    //{id: 'JOINT_ANKLE_RIGHT', index: 24, nodeScreenX: -263, nodeScreenY: 160},
    {id: 'JOINT_FOOT_RIGHT', index: 25, nodeScreenX: -263, nodeScreenY: 170},
    {id: 'JOINT_HEAD', index: 26, nodeScreenX: -243, nodeScreenY: -180}
    //{id: 'JOINT_NOSE', index: 27, nodeScreenX: 0, nodeScreenY: 0},
    //{id: 'JOINT_EYE_LEFT', index: 28, nodeScreenX: 0, nodeScreenY: 0},
    //{id: 'JOINT_EAR_LEFT', index: 29, nodeScreenX: 0, nodeScreenY: 0},
    //{id: 'JOINT_EYE_RIGHT', index: 30, nodeScreenX: 0, nodeScreenY: 0},
    //{id: 'JOINT_EAR_RIGHT', index: 31, nodeScreenX: 0, nodeScreenY: 0}
];

script.addEventListener('load', function() {
    console.log('yey load');
    if (typeof io === 'undefined' || !io) {
        console.warn('No reality zone viewer connection');

        // eslint-disable-next-line no-global-assign
        io = function() {
            return {
                on: function() {
                },
                emit: function() {
                },
            };
        };
    }

    // Connection to a reality zone viewer for pose data and sensor declaration
    socket = io(`http://${ipPort}`);
    socket.on('connect', function() {
        console.log('connected');
    });

    socket.on('/update/humanPoses', (msgStr) => {

        //console.log('Update Human Poses in Tool');
        
        let msg = JSON.parse(msgStr);
        pose = msg;
        if (msg.hasOwnProperty('pose')) {
            pose = msg.pose;
        }
        /*
        let skelHoldingPhone = -1;
        let d = 9999999;

        for (let skel of pose) {
            
            for (let joint of skel.joints) {
                joint.z = -joint.z;
                //joint.x = -joint.x;
            }
            
            if (skel.joints[8] && skel.joints[15]){
                
                //console.log(skel);
                
                posLeft = new THREE.Vector3(skel.joints[8].x, skel.joints[8].y, skel.joints[8].z);
                posRight = new THREE.Vector3(skel.joints[15].x, skel.joints[15].y, skel.joints[15].z);
                posHead = new THREE.Vector3(skel.joints[26].x, skel.joints[26].y, skel.joints[26].z);
                
            }
            
            //let phonePos = new THREE.Vector3(0,0,0);
            //groundPlaneContainerObj.worldToLocal(phonePos);
            
            // JOINT_HAND_LEFT: 8
            // JOINT_HAND_RIGHT: 15
            
            // if (distance between skel.joints[8] , skel.joints[15] and phone position from groundplane origin) < d
            // skelHoldingPhone = skel.id
            // d = new distance
        }*/
    });
});
document.body.appendChild(script);

// Cache of last sensor group position so we don't spam the rzv
let lastSGPos = '';

// Various threejs and gl proxy support variables
let realRenderer, renderer;
var camera, scene;
var mainContainerObj, groundPlaneContainerObj;
let spatialInterface;
let envelopeContents;

let isProjectionMatrixSet = false;
let isGroundPlaneFound = false;

var rendererWidth;
var rendererHeight;
var aspectRatio;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

let frameIsMoving = false;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    envelopeContents = new EnvelopeContents(spatialInterface, document.getElementById('container'));
    spatialInterface.useWebGlWorker();
}

// eslint-disable-next-line no-unused-vars
main = function ({width, height}) {
    document.body.width = width + 'px';
    document.body.height = height + 'px';
    rendererWidth = width;
    rendererHeight = height;
    aspectRatio = rendererWidth / rendererHeight;

    spatialInterface.changeFrameSize(width, height);

    init();
};

function init() {
    realRenderer = new THREE.WebGLRenderer( { alpha: true } );
    realRenderer.debug.checkShaderErrors = false;
    realRenderer.setPixelRatio(window.devicePixelRatio);
    realRenderer.setSize(rendererWidth, rendererHeight);
    // eslint-disable-next-line no-global-assign
    realGl = realRenderer.getContext();

    // create a fullscreen webgl renderer for the threejs content and add to the dom
    renderer = new THREE.WebGLRenderer( { context: gl, alpha: true } );
    renderer.debug.checkShaderErrors = false;
    //renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( rendererWidth, rendererHeight );
    //document.body.appendChild( renderer.domElement );

    // create a threejs camera and scene
    camera = new THREE.PerspectiveCamera( 70, aspectRatio, 1, 1000 );
    scene = new THREE.Scene();

    // create a parent 3D object to contain all the three js objects
    // we can apply the marker transform to this object and all of its
    // children objects will be affected
    mainContainerObj = new THREE.Object3D();
    mainContainerObj.matrixAutoUpdate = false;
    mainContainerObj.name = 'mainContainerObj';
    scene.add(mainContainerObj);

    groundPlaneContainerObj = new THREE.Object3D();
    groundPlaneContainerObj.matrixAutoUpdate = false;
    groundPlaneContainerObj.name = 'groundPlaneContainer';
    scene.add(groundPlaneContainerObj);
    
    groundPlaneContainerObj.add(skelGroup);

    // light the scene with a combination of ambient and directional white light
    /*var ambLight = new THREE.AmbientLight(0x404040);
    scene.add(ambLight);
    var dirLight1 = new THREE.DirectionalLight(0xffffff, 1);
    dirLight1.position.set(1000, 1000, 1000);
    scene.add(dirLight1);
    var dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-1000, -1000, -1000);
    scene.add(dirLight2);
    let spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(-300, -300, 1500);
    spotLight.castShadow = true;
    mainContainerObj.add(spotLight);*/

    createAxis();
    
    create2DUserInterface();

    createJoints();

    spatialInterface.onSpatialInterfaceLoaded(function() {

        
        spatialInterface.setFullScreenOn();
        spatialInterface.setStickyFullScreenOn();
        spatialInterface.subscribeToMatrix();
        spatialInterface.setVisibilityDistance(100);
        //spatialInterface.prefersAttachingToWorld();
        

        // whenever we receive new matrices from the editor, update the 3d scene
        spatialInterface.addMatrixListener(renderScene);
        spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);

        spatialInterface.setMoveDelay(-1);

        createJointNodes();
        
        //spatialInterface.registerTouchDecider(touchDecider);

        spatialInterface.subscribeToWorldId(function(worldIdTool) {
            console.log('got worldId', worldIdTool);
            if (!worldIdTool) {
                spatialInterface.errorNotification('No world object. Delete path point (or restart app), localize' +
                 ' within world first, and try again.');
            } else {
                worldId = worldIdTool;
            }
        });

        spatialInterface.addIsMovingListener(function(isMoving) {
            frameIsMoving = isMoving;
        });
        
    });
}

function createJointNodes(){

    for (let i = 0; i < POSE_JOINTS.length; i++) {
        
        spatialInterface.initNode(POSE_JOINTS[i].id, 'pathPoint', POSE_JOINTS[i].nodeScreenX, POSE_JOINTS[i].nodeScreenY, 0.2);
        spatialInterface.stickNodeToScreen(POSE_JOINTS[i].id);
    
    }
}

function createAxis(){
    let geometrycube = new THREE.BoxGeometry( 30, 30, 30 );
    let material1 = new THREE.MeshBasicMaterial( {color: 0xff0000} );
    let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
    let material3 = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
    let cube_z = new THREE.Mesh( geometrycube, material2 ); // green
    let cube_y = new THREE.Mesh( geometrycube, material3 ); // blue
    let cube_x = new THREE.Mesh( geometrycube, material1 );  // red
    groundPlaneContainerObj.add( cube_x );
    groundPlaneContainerObj.add( cube_z );
    groundPlaneContainerObj.add( cube_y );
    cube_x.position.set(50, 0, 0);
    cube_y.position.set(0, 50, 0);
    cube_z.position.set(0, 0, 50);
    cube_y.name = 'cube_y';
    cube_z.name = 'cube_z';
    cube_x.name = 'cube_x';
}

function create2DUserInterface(){
    
    let skeletonBody = document.createElement('div');
    skeletonBody.id = 'skeletonBody';
    
    document.body.appendChild( skeletonBody );
    
    playPauseButton = document.createElement('button');
    playPauseButton.id = 'playPauseButton';
    

    document.body.appendChild( playPauseButton );

    playPauseButton.addEventListener('pointerdown', onPlayButtonDown, false);
}

function onPlayButtonDown(){
    
    console.log('play button');
    
    if (globalSpeed === 0){
        
        console.log('play');
        
        globalSpeed = 1;

        playPauseButton.style.backgroundImage = "url('img/pause.png')";
    } else {

        console.log('pause');
        
        globalSpeed = 0;
        playPauseButton.style.backgroundImage = "url('img/play.png')";
    }
}

function createJoints(){
    
    console.log('CREATE JOINTS');

    const geometry = new THREE.SphereGeometry( 50, 32, 16 );
    const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );

    for (let i = 0; i < POSE_JOINTS.length; i++) {
        poseJointsSpheres[i] = new THREE.Mesh( geometry, material );
        skelGroup.add(poseJointsSpheres[i]);
        poseJointsSpheres[i].position.set(0,0,0);
    }

}

function updateJointsPos() {

    if (pose){
        //eventually take the skel that is closer to the phone
        for (let skel of pose) {

            if (skel.id === 'mir') {
                continue;
            }

            /*
            let phonePos = new THREE.Vector3(0,0,-200);
            groundPlaneContainerObj.worldToLocal(phonePos);

            // Sending phone position through pelvis joint
            if (poseJointsSpheres[0]){
                poseJointsSpheres[0].position.set(phonePos.x, phonePos.y, phonePos.z);
                updatePositionServer(0);
            }*/
            
            // z is flipped
            for (let i = 0; i < POSE_JOINTS.length; i++) {
                if (poseJointsSpheres[i]){
                    poseJointsSpheres[i].position.set(skel.joints[POSE_JOINTS[i].index].x * factor, skel.joints[POSE_JOINTS[i].index].y * factor, (-1) * skel.joints[POSE_JOINTS[i].index].z * factor);
                    updatePositionServer(i);
                }
            }
        }
    }
}

function touchDecider(eventData) {
    //1. sets the mouse position with a coordinate system where the center
    //   of the screen is the origin
    mouse.x = (eventData.x / window.innerWidth) * 2 - 1;
    mouse.y = - (eventData.y / window.innerHeight) * 2 + 1;

    //2. set the picking ray from the camera position and mouse coordinates
    raycaster.setFromCamera(mouse, camera);

    //3. compute intersections
    var intersects = raycaster.intersectObjects(scene.children, true);

    return intersects.length > 0;
}

function setMatrixFromArray(matrix, array) {
    matrix.set( array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]
    );
}

let lastProjectionMatrix = null;
let lastModelViewMatrix = null;
let lastFrameMovement = Date.now();

function renderScene(modelViewMatrix, projectionMatrix) {
    lastProjectionMatrix = projectionMatrix;
    lastModelViewMatrix = modelViewMatrix;
}

function groundPlaneCallback(groundPlaneMatrix, _projectionMatrix) {
    if (isProjectionMatrixSet) {

        //console.log('groundplanecallback: ', groundPlaneMatrix);
        
        // CHECK HERE WHEN THIS GETS CALLED
        setMatrixFromArray(groundPlaneContainerObj.matrix, groundPlaneMatrix);  // update model view matrix

        if (!isGroundPlaneFound) {
            isGroundPlaneFound = true;
        }

    }
}
let done = false;

// Draw the scene repeatedly
// eslint-disable-next-line no-undef
render = function(_now) {
    // only set the projection matrix for the camera 1 time, since it stays the same
    if (!isProjectionMatrixSet && lastProjectionMatrix && lastProjectionMatrix.length === 16) {
        setMatrixFromArray(camera.projectionMatrix, lastProjectionMatrix);
        camera.projectionMatrixInverse.getInverse(camera.projectionMatrix);
        isProjectionMatrixSet = true;
    }

    if (isProjectionMatrixSet && lastModelViewMatrix && lastModelViewMatrix.length === 16) {

        // update model view matrix
        setMatrixFromArray(mainContainerObj.matrix, lastModelViewMatrix);
        // render the scene
        mainContainerObj.visible = true;

        if (renderer && scene && camera) {

            initTimer++;
            if (initTimer > 100) updateJointsPos();
            
            renderer.render(scene, camera);
            if (done && realGl) {

                for (let proxy of proxies) {
                    proxy.__uncloneableObj = null;
                    delete proxy.__uncloneableObj;
                }
                // eslint-disable-next-line no-global-assign
                proxies = [];
                realRenderer.dispose();
                realRenderer.forceContextLoss();
                realRenderer.context = null;
                realRenderer.domElement = null;
                realRenderer = null;
                // eslint-disable-next-line no-global-assign
                realGl = null;
            }
            done = true;
        }
    }
};

function updatePositionServer(jointId) {
    
    if (jointId === 0) console.log('Joint local position: ', poseJointsSpheres[jointId].position.x, poseJointsSpheres[jointId].position.y, poseJointsSpheres[jointId].position.z);

    // write position into pathPoint
    let point = {
        matrix: poseJointsSpheres[jointId].matrix,    // This should be the matrix of the joint relative to world origin (groundplane origin)
        speed: globalSpeed
    };
    let message = {
        address: {
            object: spatialObject.object,
            tool: spatialObject.frame,
            node: spatialObject.node
        },
        points: [point],
        worldObject: worldId
    };
    spatialInterface.write(POSE_JOINTS[jointId].id, message, 'c', 'pathPoint');
    
}
