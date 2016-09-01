angular.module('app.controllers', [])

.controller('TabsCtrl', function($scope, $rootScope, MainService, $cordovaBeacon, AuthService, $ionicPlatform) {
    
    $rootScope.rangedBeacons = [];
    $rootScope.inRangeBeacons = {};
    $ionicPlatform.ready(function() {
        
        if (window.cordova){$cordovaBeacon.requestWhenInUseAuthorization();}
        
        $rootScope.$on("$cordovaBeacon:didRangeBeaconsInRegion", function(event, pluginResult) {
            var uniqueBeaconKey;
            for(var i = 0; i < pluginResult.beacons.length; i++) {
                uniqueBeaconKey = pluginResult.beacons[i].uuid + ":" + pluginResult.beacons[i].major + ":" + pluginResult.beacons[i].minor;
                $rootScope.inRangeBeacons[uniqueBeaconKey] = pluginResult.beacons[i];
            }
            $scope.$apply();
        });
        MainService.getBeacons().then(function(data){
            $rootScope.rangedBeacons = data;
            for (var index in $rootScope.rangedBeacons){
                var beacon = $rootScope.rangedBeacons[index];
                if (window.cordova){$cordovaBeacon.startRangingBeaconsInRegion($cordovaBeacon.createBeaconRegion("estimote" + index, beacon.uuid, beacon.major, beacon.minor));}
            }
        });
 
    });
})




.controller('NotificationsCtrl', function($scope, $cordovaBeacon, $rootScope) {
    $scope.notifications = [];
    
    $scope.getNotificationsLength = function(){
        return $scope.notifications.length + Object.keys($rootScope.inRangeBeacons).length;
    }
    

    
    
    
    
    
    
})



.controller('DragCtrl', function($scope, MainService, AuthService, $rootScope, $cordovaBeacon, $ionicPopup, $cordovaSocialSharing, $ionicModal, $cordovaDeviceMotion, $cordovaGeolocation, $cordovaDevice) {
    $scope.advert = {};



    
    
    $ionicModal.fromTemplateUrl('templates/modals/advert.html', {
        scope: $scope,
        animation: 'slide-in-down'
    }).then(function(modal) {
        $scope.advertModal = modal;
    });    
    
    $scope.openAdvertModal = function(){
        $scope.advertModal.show();
    }

    
    $scope.getAdvert = function(beacon){
        $scope.advert = {};
        MainService.getAdvert(beacon).then(function(data){
            $scope.advert = data;
        },function(data){
            if (data.status_code === 401){
                AuthService.register();
            } 
        })        
    }
    $scope.acceleration = {};
    // watch Acceleration
    document.addEventListener("deviceready", function(){
        var watch = $cordovaDeviceMotion.watchAcceleration({ frequency: 1000 });
        watch.then(
          null,
          function(error) {
          // An error occurred
          console.log(error);
          },
          function(result) {
            var x = result.x;
            var y = result.y;
            var z = result.z;
            var timeStamp = result.timestamp;
            
            if ($scope.acceleration.y < 8 && y > 8 && $scope.acceleration.z > 3 && z > -3 && z < 3){
                console.log("grabbed");
                console.log($rootScope.inRangeBeacons);
            }
            if (($scope.acceleration.y < 8 && y > 8 && $scope.acceleration.z > 3 && z > -3 && z < 3) && Object.keys($rootScope.inRangeBeacons).length > 0){ //TODO have condition for phone acceleration
                console.log("hey its met");
                
                var beacon = {}; var proximity = false; //TODO find cloest beacon
                for (var index in $rootScope.inRangeBeacons){
                    console.log($rootScope.inRangeBeacons[index]);
                    if ($rootScope.inRangeBeacons[index].proximity === "ProximityImmediate"){
                        beacon = $rootScope.inRangeBeacons[index];
                        proximity = "ProximityImmediate";
                        break;
                    }
                    else if ($rootScope.inRangeBeacons[index].proximity === "ProximityNear" && proximity !== "ProximityImmediate"){
                        beacon = $rootScope.inRangeBeacons[index];
                        proximity = "ProximityNear";
                    }
                    else if (proximity !== "ProximityImmediate" && proximity !== "ProximityNear"){
                        beacon = $rootScope.inRangeBeacons[index];
                    }
                }
                console.log(beacon);
                $scope.getAdvert(beacon); //TODO add uuid, minor, major into api instead of beacon code
                $scope.advertModal.show();                
            }
            $scope.acceleration = result;
        });
    },false);
    
 
    $scope.doAction = function(action){
        $scope.saveRecord(action);
        if (action === 'phone'){
            window.open('tel:' + $scope.advert.phone, '_system')
        }
        else if (action === 'link'){
            window.open($scope.advert.link, "_system");
        }
        else if (action === 'location'){
            window.open("https://www.google.com/maps/place/" + $scope.advert.location, "_system");
        }
        else if (action === 'info'){
            $scope.openInfoPopup();
        }
        else if (action === 'share'){
            $cordovaSocialSharing
                .share($scope.advert.name, $scope.advert.name, null, $scope.advert.image) // Share via native share sheet
             
        }
    }
    
    $scope.openInfoPopup = function(){
        var alertPopup = $ionicPopup.alert({
          title: 'Information',
          template: '<span ng-show="advert.company">Company: ' + $scope.advert.company + '<br></span>\n\
                     <span ng-show="advert.category">Category: ' + $scope.advert.category + '<br></span>\n\
                     ' + $scope.advert.description
        });       
    }
    
    
    
    $scope.saveRecord = function(action){ //executed when an action is made on an advert
        $cordovaGeolocation
          .getCurrentPosition({timeout: 10000, enableHighAccuracy: false})
          .then(function (position) {
            var lat  = position.coords.latitude;
            var long = position.coords.longitude;
            console.log(position);
            var uuid = $cordovaDevice.getUUID();
            var record = {advert_id: $scope.advert.id, action:action, device: $rootScope.devicePlatform + ionic.Platform.version(), device_id: uuid, location:lat + ", " + long}
            MainService.saveRecord(record);
          }, function(err) {
            // error
          });        
    }
    
    
    
})

.controller('HistoryCtrl', function($scope, MainService, AuthService, $ionicModal, $cordovaSocialSharing, $ionicPopup) {
    $scope.loading = false;
    $scope.records = [];
    
    $scope.doRefresh = function(){  
        $scope.loading = true;
        MainService.getRecords().then(function(data){
            $scope.loading = false;
            $scope.$broadcast('scroll.refreshComplete');
            $scope.records = data;
        },function(data){
            $scope.$broadcast('scroll.refreshComplete');
            if (data.status_code === 401){
                AuthService.register();
            } 
        })
    }
    $scope.doRefresh();   
    
    $scope.advert = {};

    $ionicModal.fromTemplateUrl('templates/modals/advert.html', {
        scope: $scope,
        animation: 'fade-in-scale'
    }).then(function(modal) {
        $scope.advertModal = modal;
    });    
    
    $scope.openAdvertModal = function(){
        $scope.advertModal.show();
    }

    
    $scope.getAdvert = function(recordId){
        $scope.advert = {};    
        for (var index in $scope.records){
            if ($scope.records[index].id === recordId){
                $scope.advert = $scope.records[index].advert;
            }
        } 
        if ($scope.advert.id){
            $scope.openAdvertModal();
        }
    }    
    
    $scope.doAction = function(action){
        if (!$scope.advert.id){return;}
        $scope.saveRecord(action);
        if (action === 'phone'){
            window.open('tel:' + $scope.advert.phone, '_system')
        }
        else if (action === 'link'){
            window.open($scope.advert.link, "_system");
        }
        else if (action === 'location'){
            window.open("https://www.google.com/maps/place/" + $scope.advert.location, "_system");
        }
        else if (action === 'info'){
            $scope.openInfoPopup();
        }
        else if (action === 'share'){
            $cordovaSocialSharing
                .share($scope.advert.name, $scope.advert.name, null, $scope.advert.image) // Share via native share sheet
             
        }
    }
    
    $scope.openInfoPopup = function(){
        var alertPopup = $ionicPopup.alert({
          title: 'Information',
          template: '<span ng-if="advert.company">Company: ' + $scope.advert.company + '<br></span>\n\
                     <span ng-if="advert.category">Category: ' + $scope.advert.category + '<br></span>\n\
                     ' + $scope.advert.description
        });       
    }    
    
})




;
