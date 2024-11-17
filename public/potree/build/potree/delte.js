initClippingTool(){


    this.viewer.addEventListener("cliptask_changed", (event) => {
        console.log("TODO");
    });

    this.viewer.addEventListener("clipmethod_changed", (event) => {
        console.log("TODO");
    });

    {
        let elClipTask = $("#cliptask_options");
        elClipTask.selectgroup({title: "Clip Task"});

        elClipTask.find("input").click( (e) => {
            this.viewer.setClipTask(ClipTask[e.target.value]);
        });

        let currentClipTask = Object.keys(ClipTask)
            .filter(key => ClipTask[key] === this.viewer.clipTask);
        elClipTask.find(`input[value=${currentClipTask}]`).trigger("click");
    }

    {
        let elClipMethod = $("#clipmethod_options");
        elClipMethod.selectgroup({title: "Clip Method"});

        elClipMethod.find("input").click( (e) => {
            this.viewer.setClipMethod(ClipMethod[e.target.value]);
        });

        let currentClipMethod = Object.keys(ClipMethod)
            .filter(key => ClipMethod[key] === this.viewer.clipMethod);
        elClipMethod.find(`input[value=${currentClipMethod}]`).trigger("click");
    }

    let clippingToolBar = $("#clipping_tools");

    // CLIP VOLUME
    clippingToolBar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/clip_volume.svg',
        '[title]tt.clip_volume',
        () => {
            let item = this.volumeTool.startInsertion({clip: true}); 

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === item.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // CLIP POLYGON
    clippingToolBar.append(this.createToolIcon(
        Potree.resourcePath + "/icons/clip-polygon.svg",
        "[title]tt.clip_polygon",
        () => {
            let item = this.viewer.clippingTool.startInsertion({type: "polygon"});

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === item.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    {// SCREEN BOX SELECT
        let boxSelectTool = new ScreenBoxSelectTool(this.viewer);

        clippingToolBar.append(this.createToolIcon(
            Potree.resourcePath + "/icons/clip-screen.svg",
            "[title]tt.screen_clip_box",
            () => {
                if(!(this.viewer.scene.getActiveCamera() instanceof OrthographicCamera)){
                    this.viewer.postMessage(`Switch to Orthographic Camera Mode before using the Screen-Box-Select tool.`, 
                        {duration: 2000});
                    return;
                }
                
                let item = boxSelectTool.startInsertion();

                let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
                let jsonNode = measurementsRoot.children.find(child => child.data.uuid === item.uuid);
                $.jstree.reference(jsonNode.id).deselect_all();
                $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
            }
        ));
    }

    { // REMOVE CLIPPING TOOLS
        clippingToolBar.append(this.createToolIcon(
            Potree.resourcePath + "/icons/remove.svg",
            "[title]tt.remove_all_clipping_volumes",
            () => {

                this.viewer.scene.removeAllClipVolumes();
            }
        ));
    }

}


//navigation
initNavigation(){
    let elNavigation = $('#navigation');
    let sldMoveSpeed = $('#sldMoveSpeed');
    let lblMoveSpeed = $('#lblMoveSpeed');

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + '/icons/earth_controls_1.png',
        '[title]tt.earth_control',
        () => { this.viewer.setControls(this.viewer.earthControls); }
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + '/icons/fps_controls.svg',
        '[title]tt.flight_control',
        () => {
            this.viewer.setControls(this.viewer.fpControls);
            this.viewer.fpControls.lockElevation = false;
        }
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + '/icons/helicopter_controls.svg',
        '[title]tt.heli_control',
        () => { 
            this.viewer.setControls(this.viewer.fpControls);
            this.viewer.fpControls.lockElevation = true;
        }
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + '/icons/orbit_controls.svg',
        '[title]tt.orbit_control',
        () => { this.viewer.setControls(this.viewer.orbitControls); }
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + '/icons/focus.svg',
        '[title]tt.focus_control',
        () => { this.viewer.fitToScreen(); }
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/icons/navigation_cube.svg",
        "[title]tt.navigation_cube_control",
        () => {this.viewer.toggleNavigationCube();}
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/images/compas.svg",
        "[title]tt.compass",
        () => {
            const visible = !this.viewer.compass.isVisible();
            this.viewer.compass.setVisible(visible);
        }
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/icons/camera_animation.svg",
        "[title]tt.camera_animation",
        () => {
            const animation = CameraAnimation.defaultFromView(this.viewer);

            viewer.scene.addCameraAnimation(animation);
        }
    ));


    elNavigation.append("<br>");


    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/icons/left.svg",
        "[title]tt.left_view_control",
        () => {this.viewer.setLeftView();}
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/icons/right.svg",
        "[title]tt.right_view_control",
        () => {this.viewer.setRightView();}
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/icons/front.svg",
        "[title]tt.front_view_control",
        () => {this.viewer.setFrontView();}
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/icons/back.svg",
        "[title]tt.back_view_control",
        () => {this.viewer.setBackView();}
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/icons/top.svg",
        "[title]tt.top_view_control",
        () => {this.viewer.setTopView();}
    ));

    elNavigation.append(this.createToolIcon(
        Potree.resourcePath + "/icons/bottom.svg",
        "[title]tt.bottom_view_control",
        () => {this.viewer.setBottomView();}
    ));





    let elCameraProjection = $(`
    <selectgroup id="camera_projection_options">
        <option id="camera_projection_options_perspective" value="PERSPECTIVE">Perspective</option>
        <option id="camera_projection_options_orthigraphic" value="ORTHOGRAPHIC">Orthographic</option>
    </selectgroup>
`);
    elNavigation.append(elCameraProjection);
    elCameraProjection.selectgroup({title: "Camera Projection"});
    elCameraProjection.find("input").click( (e) => {
        this.viewer.setCameraMode(CameraMode[e.target.value]);
    });
    let cameraMode = Object.keys(CameraMode)
        .filter(key => CameraMode[key] === this.viewer.scene.cameraMode);
    elCameraProjection.find(`input[value=${cameraMode}]`).trigger("click");

    let speedRange = new Vector2(1, 10 * 1000);

    let toLinearSpeed = (value) => {
        return Math.pow(value, 4) * speedRange.y + speedRange.x;
    };

    let toExpSpeed = (value) => {
        return Math.pow((value - speedRange.x) / speedRange.y, 1 / 4);
    };

    sldMoveSpeed.slider({
        value: toExpSpeed(this.viewer.getMoveSpeed()),
        min: 0,
        max: 1,
        step: 0.01,
        slide: (event, ui) => { this.viewer.setMoveSpeed(toLinearSpeed(ui.value)); }
    });

    this.viewer.addEventListener('move_speed_changed', (event) => {
        lblMoveSpeed.html(this.viewer.getMoveSpeed().toFixed(1));
        sldMoveSpeed.slider({value: toExpSpeed(this.viewer.getMoveSpeed())});
    });

    lblMoveSpeed.html(this.viewer.getMoveSpeed().toFixed(1));
}

//toolbar
initToolbar(){

    // ANGLE
    let elToolbar = $('#tools');
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/angle.png',
        '[title]tt.angle_measurement',
        () => {
            $('#menu_measurements').next().slideDown();
            let measurement = this.measuringTool.startInsertion({
                showDistances: false,
                showAngles: true,
                showArea: false,
                closed: true,
                maxMarkers: 3,
                name: 'Angle'});

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === measurement.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // POINT
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/point.svg',
        '[title]tt.point_measurement',
        () => {
            $('#menu_measurements').next().slideDown();
            let measurement = this.measuringTool.startInsertion({
                showDistances: false,
                showAngles: false,
                showCoordinates: true,
                showArea: false,
                closed: true,
                maxMarkers: 1,
                name: 'Point'});

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === measurement.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // DISTANCE
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/distance.svg',
        '[title]tt.distance_measurement',
        () => {
            $('#menu_measurements').next().slideDown();
            let measurement = this.measuringTool.startInsertion({
                showDistances: true,
                showArea: false,
                closed: false,
                name: 'Distance'});

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === measurement.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // HEIGHT
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/height.svg',
        '[title]tt.height_measurement',
        () => {
            $('#menu_measurements').next().slideDown();
            let measurement = this.measuringTool.startInsertion({
                showDistances: false,
                showHeight: true,
                showArea: false,
                closed: false,
                maxMarkers: 2,
                name: 'Height'});

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === measurement.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // CIRCLE
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/circle.svg',
        '[title]tt.circle_measurement',
        () => {
            $('#menu_measurements').next().slideDown();
            let measurement = this.measuringTool.startInsertion({
                showDistances: false,
                showHeight: false,
                showArea: false,
                showCircle: true,
                showEdges: false,
                closed: false,
                maxMarkers: 3,
                name: 'Circle'});

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === measurement.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // AZIMUTH
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/azimuth.svg',
        'Azimuth',
        () => {
            $('#menu_measurements').next().slideDown();
            let measurement = this.measuringTool.startInsertion({
                showDistances: false,
                showHeight: false,
                showArea: false,
                showCircle: false,
                showEdges: false,
                showAzimuth: true,
                closed: false,
                maxMarkers: 2,
                name: 'Azimuth'});

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === measurement.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // AREA
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/area.svg',
        '[title]tt.area_measurement',
        () => {
            $('#menu_measurements').next().slideDown();
            let measurement = this.measuringTool.startInsertion({
                showDistances: true,
                showArea: true,
                closed: true,
                name: 'Area'});

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === measurement.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // VOLUME
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/volume.svg',
        '[title]tt.volume_measurement',
        () => {
            let volume = this.volumeTool.startInsertion(); 

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === volume.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // SPHERE VOLUME
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/sphere_distances.svg',
        '[title]tt.volume_measurement',
        () => { 
            let volume = this.volumeTool.startInsertion({type: SphereVolume}); 

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === volume.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // PROFILE
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/profile.svg',
        '[title]tt.height_profile',
        () => {
            $('#menu_measurements').next().slideDown(); ;
            let profile = this.profileTool.startInsertion();

            let measurementsRoot = $("#jstree_scene").jstree().get_json("measurements");
            let jsonNode = measurementsRoot.children.find(child => child.data.uuid === profile.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // ANNOTATION
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/annotation.svg',
        '[title]tt.annotation',
        () => {
            $('#menu_measurements').next().slideDown(); ;
            let annotation = this.viewer.annotationTool.startInsertion();

            let annotationsRoot = $("#jstree_scene").jstree().get_json("annotations");
            let jsonNode = annotationsRoot.children.find(child => child.data.uuid === annotation.uuid);
            $.jstree.reference(jsonNode.id).deselect_all();
            $.jstree.reference(jsonNode.id).select_node(jsonNode.id);
        }
    ));

    // REMOVE ALL
    elToolbar.append(this.createToolIcon(
        Potree.resourcePath + '/icons/reset_tools.svg',
        '[title]tt.remove_all_measurement',
        () => {
            this.viewer.scene.removeAllMeasurements();
        }
    ));


    { // SHOW / HIDE Measurements
        let elShow = $("#measurement_options_show");
        elShow.selectgroup({title: "Show/Hide labels"});

        elShow.find("input").click( (e) => {
            const show = e.target.value === "SHOW";
            this.measuringTool.showLabels = show;
        });

        let currentShow = this.measuringTool.showLabels ? "SHOW" : "HIDE";
        elShow.find(`input[value=${currentShow}]`).trigger("click");
    }
}
