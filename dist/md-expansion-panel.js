(function(){"use strict";/**
 * @ngdoc module
 * @name material.components.expansionPanels
 *
 * @description
 * Expansion panel component
 */
angular
  .module('material.components.expansionPanels', [
    'material.core'
  ]);
}());
(function(){"use strict";angular
  .module('material.components.expansionPanels')
  .directive('mdExpansionPanel', expansionPanelDirective);


var ANIMATION_TIME = 180; //ms


/**
 * @ngdoc directive
 * @name mdExpansionPanel
 * @module material.components.expansionPanels
 *
 * @restrict E
 *
 * @description
 * `mdExpansionPanel` is the main container for panels
 *
 * @param {string=} md-component-id - add an id if you want to acces the panel via the `$mdExpansionPanel` service
 **/
function expansionPanelDirective() {
  var directive = {
    restrict: 'E',
    require: ['mdExpansionPanel', '?^^mdExpansionPanelGroup'],
    scope: true,
    compile: compile,
    controller: ['$scope', '$element', '$attrs', '$window', '$$rAF', '$mdConstant', '$mdUtil', '$mdComponentRegistry', '$timeout', '$q', controller]
  };
  return directive;




  function compile(tElement, tAttrs) {
    var INVALID_PREFIX = 'Invalid HTML for md-expansion-panel: ';

    tElement.attr('tabindex', tAttrs.tabindex || '0');

    if (tElement[0].querySelector('md-expansion-panel-collapsed') === null) {
      throw Error(INVALID_PREFIX + 'Expected a child element of `md-epxansion-panel-collapsed`');
    }
    if (tElement[0].querySelector('md-expansion-panel-expanded') === null) {
      throw Error(INVALID_PREFIX + 'Expected a child element of `md-epxansion-panel-expanded`');
    }

    return function postLink(scope, element, attrs, ctrls) {
      var epxansionPanelCtrl = ctrls[0];
      var epxansionPanelGroupCtrl = ctrls[1];

      if (epxansionPanelGroupCtrl) {
        epxansionPanelCtrl.epxansionPanelGroupCtrl = epxansionPanelGroupCtrl;
        epxansionPanelGroupCtrl.addPanel(epxansionPanelCtrl.componentId, {
          expand: epxansionPanelCtrl.expand,
          collapse: epxansionPanelCtrl.collapse,
          remove: epxansionPanelCtrl.remove
        });
      }
    };
  }




  function controller($scope, $element, $attrs, $window, $$rAF, $mdConstant, $mdUtil, $mdComponentRegistry, $timeout, $q) {
    /* jshint validthis: true */
    var vm = this;

    var collapsedCtrl;
    var expandedCtrl;
    var headerCtrl;
    var footerCtrl;
    var deregister;
    var scrollContainer;
    var stickyContainer;
    var topKiller;
    var resizeKiller;
    var isOpen = false;
    var isDisabled = false;
    var debouncedUpdateScroll = $$rAF.throttle(updateScroll);
    var debouncedUpdateResize = $$rAF.throttle(updateResize);

    vm.registerCollapsed = function (ctrl) { collapsedCtrl = ctrl; };
    vm.registerExpanded = function (ctrl) { expandedCtrl = ctrl; };
    vm.registerHeader = function (ctrl) { headerCtrl = ctrl; };
    vm.registerFooter = function (ctrl) { footerCtrl = ctrl; };

    vm.$element = $element;
    vm.componentId = $attrs.mdComponentId;
    vm.expand = expand;
    vm.collapse = collapse;
    vm.remove = remove;

    $attrs.$observe('disabled', function(disabled) {
      isDisabled = (typeof disabled === 'string' && disabled !== 'false') ? true : false;

      if (isDisabled === true) {
        $element.attr('tabindex', '-1');
      } else {
        $element.attr('tabindex', '0');
      }
    });

    $element
      .on('focus', function (ev) {
        $element.on('keydown', handleKeypress);
      })
      .on('blur', function (ev) {
        $element.off('keydown', handleKeypress);
      });

    function handleKeypress(ev) {
      var keyCodes = $mdConstant.KEY_CODE;
      switch (ev.keyCode) {
        case keyCodes.ENTER:
          expand();
          break;
        case keyCodes.ESCAPE:
          collapse();
          break;
      }
    }


    $scope.$panel = {
      collapse: collapse,
      expand: expand,
      remove: remove
    };


    $scope.$on('$destroy', function () {
      // remove component from registry
      if (typeof deregister === 'function') { deregister(); }
      killEvents();
    });


    if ($attrs.mdComponentId) {
      deregister = $mdComponentRegistry.register({
        expand: expand,
        collapse: collapse,
        remove: remove,
        componentId: $attrs.mdComponentId
      }, $attrs.mdComponentId);
    }



    function expand() {
      if (isOpen === true || isDisabled === true) { return; }
      isOpen = true;

      var deferred = $q.defer();

      if (vm.epxansionPanelGroupCtrl) {
        vm.epxansionPanelGroupCtrl.expandPanel(vm.componentId);
      }

      $element.removeClass('md-close');
      $element.addClass('md-open');

      initEvents();
      collapsedCtrl.hide();
      expandedCtrl.show();

      if (headerCtrl) { headerCtrl.show(); }
      if (footerCtrl) { footerCtrl.show(); }

      $timeout(function () {
        deferred.resolve();
      }, ANIMATION_TIME);
      return deferred.promise;
    }


    function collapse() {
      if (isOpen === false) { return; }
      isOpen = false;

      var deferred = $q.defer();

      $element.addClass('md-close');
      $element.removeClass('md-open');

      killEvents();
      collapsedCtrl.show();
      expandedCtrl.hide();

      if (headerCtrl) { headerCtrl.hide(); }
      if (footerCtrl) { footerCtrl.hide(); }

      $timeout(function () {
        deferred.resolve();
      }, ANIMATION_TIME);
      return deferred.promise;
    }


    function remove(noAnimation) {
      var deferred = $q.defer();

      if (vm.epxansionPanelGroupCtrl) {
        vm.epxansionPanelGroupCtrl.removePanel(vm.componentId);
      }

      if (noAnimation === true || isOpen === false) {
        $scope.$destroy();
        $element.remove();
        deferred.resolve();
      } else {
        collapse();
        $timeout(function () {
          $scope.$destroy();
          $element.remove();
          deferred.resolve();
        }, ANIMATION_TIME);
      }

      return deferred.promise;
    }



    function initEvents() {
      if ((!footerCtrl || footerCtrl.noSticky === true) && (!headerCtrl || headerCtrl.noSticky === true)) {
        return;
      }

      // watch for panel position changes
      topKiller = $scope.$watch(function () { return $element[0].offsetTop; }, debouncedUpdateScroll, true);

      // watch for panel position changes
      resizeKiller = $scope.$watch(function () { return $element[0].offsetWidth; }, debouncedUpdateResize, true);

      // listen to md-content scroll events id we are nested in one
      scrollContainer = $mdUtil.getNearestContentElement($element);
      if (scrollContainer.nodeName === 'MD-CONTENT') {
        angular.element(scrollContainer).on('scroll', debouncedUpdateScroll);
      }

      // listen to expanded content scroll if height is set
      if (expandedCtrl.setHeight === true) {
        expandedCtrl.$element.on('scroll', debouncedUpdateScroll);
      }

      // listen to window scroll events
      angular.element($window)
        .on('scroll', debouncedUpdateScroll)
        .on('resize', debouncedUpdateScroll);
    }


    function killEvents() {
      if (typeof topKiller === 'function') {
        topKiller();
        topKiller = undefined;
      }

      if (typeof resizeKiller === 'function') {
        resizeKiller();
        resizeKiller = undefined;
      }

      if (scrollContainer && scrollContainer.nodeName === 'MD-CONTENT') {
        angular.element(scrollContainer).off('scroll', debouncedUpdateScroll);
      }

      if (expandedCtrl.setHeight === true) {
        expandedCtrl.$element.off('scroll', debouncedUpdateScroll);
      }

      angular.element($window)
        .off('scroll', debouncedUpdateScroll)
        .off('resize', debouncedUpdateScroll);
    }


    function updateScroll(e) {
      var top;
      var bottom;
      var bounds;
      if (expandedCtrl.setHeight === true) {
        bounds = expandedCtrl.$element[0].getBoundingClientRect();
      } else {
        bounds = scrollContainer.getBoundingClientRect();
      }

      // we never want the header going post the top of the page. to prevent this don't allow top to go below 0
      top = Math.max(bounds.top, 0);
      bottom = top + bounds.height;

      if (footerCtrl && footerCtrl.noSticky === false) { footerCtrl.onScroll(top, bottom); }
      if (headerCtrl && headerCtrl.noSticky === false) { headerCtrl.onScroll(top, bottom); }
    }


    function updateResize(value) {
      if (footerCtrl && footerCtrl.noSticky === false) { footerCtrl.onResize(value); }
      if (headerCtrl && headerCtrl.noSticky === false) { headerCtrl.onResize(value); }
    }
  }
}
}());
(function(){"use strict";angular
  .module('material.components.expansionPanels')
  .factory('$mdExpansionPanel', expansionPanelService);


/**
 * @ngdoc service
 * @name $mdExpansionPanel
 * @module material.components.expansionPanels
 *
 * @description
 * Expand and collapse Expansion Panel using its `md-component-id`
 *
 * @example
 * $mdExpansionPanel('comonentId').then(function (instance) {
 *  instance.exapand();
 *  instance.collapse();
 * });
 */
expansionPanelService.$inject = ['$mdComponentRegistry'];
function expansionPanelService($mdComponentRegistry) {
  return function (handle) {
    return $mdComponentRegistry
        .when(handle)
        .then(function (instance) {
          return instance;
        });
  };
}
}());
(function(){"use strict";angular
  .module('material.components.expansionPanels')
  .directive('mdExpansionPanelCollapsed', expansionPanelCollapsedDirective);



/**
 * @ngdoc directive
 * @name mdExpansionPanelCollapsed
 * @module material.components.expansionPanels
 *
 * @restrict E
 *
 * @description
 * `mdExpansionPanelCollapsed` is used to contain content when the panel is collapsed
 **/
expansionPanelCollapsedDirective.$inject = ['$animateCss'];
function expansionPanelCollapsedDirective($animateCss) {
  var directive = {
    restrict: 'E',
    require: '^^mdExpansionPanel',
    link: link
  };
  return directive;


  function link(scope, element, attrs, expansionPanelCtrl) {
    expansionPanelCtrl.registerCollapsed({
      show: show,
      hide: hide
    });


    element.on('click', function () {
      expansionPanelCtrl.expand();
    });


    function hide() {
      // set width to maintian demensions when element is set to postion: absolute
      element.css('width', element[0].offsetWidth + 'px');

      // set min height so the expansion panel does not shrink when collapsed element is set to position: absolute
      expansionPanelCtrl.$element.css('min-height', element[0].offsetHeight + 'px');

      $animateCss(element, {
        addClass: 'md-absolute md-hide',
        from: {opacity: 1},
        to: {opacity: 0}
      })
      .start()
      .then(function () {
        element.removeClass('md-hide');
        element.css('display', 'none');
      });
    }


    function show() {
      element.css('display', '');

      // set width to maintian demensions when element is set to postion: absolute
      element.css('width', element[0].parentNode.offsetWidth + 'px');

      $animateCss(element, {
        addClass: 'md-show',
        from: {opacity: 0},
        to: {opacity: 1}
      })
      .start()
      .then(function () {
        element.removeClass('md-absolute md-show');

        // remove width when element is no longer position: absolute
        element.css('width', '');

        // remove min height when element is no longer position: absolute
        expansionPanelCtrl.$element.css('min-height', '');
      });
    }
  }
}
}());
(function(){"use strict";angular
  .module('material.components.expansionPanels')
  .directive('mdExpansionPanelExpanded', expansionPanelExpandedDirective);



/**
 * @ngdoc directive
 * @name mdExpansionPanelExpanded
 * @module material.components.expansionPanels
 *
 * @restrict E
 *
 * @description
 * `mdExpansionPanelExpanded` is used to contain content when the panel is expanded
 *
 * @param {number=} height - add this aatribute set the max height of the expanded content. The container will be set to scroll
 **/
expansionPanelExpandedDirective.$inject = ['$animateCss'];
function expansionPanelExpandedDirective($animateCss) {
  var directive = {
    restrict: 'E',
    require: '^^mdExpansionPanel',
    link: link
  };
  return directive;


  function link(scope, element, attrs, expansionPanelCtrl) {
    var setHeight = attrs.height || undefined;
    if (setHeight !== undefined) { setHeight = setHeight.replace('px', '') + 'px'; }

    expansionPanelCtrl.registerExpanded({
      show: show,
      hide: hide,
      setHeight: setHeight !== undefined,
      $element: element
    });




    function hide() {
      var height = setHeight ? setHeight : element[0].scrollHeight + 'px';
      element.addClass('md-hide md-overflow');
      element.removeClass('md-show md-scroll-y');

      $animateCss(element, {
        from: {'max-height': height, opacity: 1},
        to: {'max-height': '48px', opacity: 0}
      })
      .start()
      .then(function () {
        element.css('display', 'none');
        element.removeClass('md-hide');
      });
    }


    function show() {
      element.css('display', '');
      element.addClass('md-show md-overflow');

      // use passed in height or the contents height
      var height = setHeight ? setHeight : element[0].scrollHeight + 'px';

      $animateCss(element, {
        from: {'max-height': '48px', opacity: 0},
        to: {'max-height': height, opacity: 1}
      })
      .start()
      .then(function () {

        // if height was passed in then set div to scroll
        if (setHeight !== undefined) {
          element.addClass('md-scroll-y');
        } else {
          element.css('max-height', 'none');
        }

        element.removeClass('md-overflow');
      });
    }
  }
}
}());
(function(){"use strict";angular
  .module('material.components.expansionPanels')
  .directive('mdExpansionPanelFooter', expansionPanelFooterDirective);




/**
 * @ngdoc directive
 * @name mdExpansionPanelFooter
 * @module material.components.expansionPanels
 *
 * @restrict E
 *
 * @description
 * `mdExpansionPanelFooter` is nested inside of `mdExpansionPanelExpanded` and contains content you want at the bottom.
 * By default the Footer will stick to the bottom of the page if the panel expands past
 * this is optional
 *
 * @param {boolean=} md-no-sticky - add this aatribute to disable sticky
 **/
function expansionPanelFooterDirective() {
  var directive = {
    restrict: 'E',
    transclude: true,
    template: '<div class="md-expansion-panel-footer-container" ng-transclude></div>',
    require: '^^mdExpansionPanel',
    link: link
  };
  return directive;



  function link(scope, element, attrs, expansionPanelCtrl) {
    var isStuck = false;
    var noSticky = attrs.mdNoSticky !== undefined;
    var container = angular.element(element[0].querySelector('.md-expansion-panel-footer-container'));

    expansionPanelCtrl.registerFooter({
      show: show,
      hide: hide,
      onScroll: onScroll,
      onResize: onResize,
      noSticky: noSticky
    });



    function show() {

    }
    function hide() {
      unstick();
    }

    function onScroll(top, bottom) {
      var height;
      var footerBounds = element[0].getBoundingClientRect();
      var panelTop = element[0].parentNode.getBoundingClientRect().top;
      var offset = panelTop - bottom;

      if (footerBounds.bottom > bottom) {
        height = container[0].offsetHeight;

        // offset will push the fotter down when it hit the top of the card
        offset = Math.max(offset + height, 0);

        // set container width because element becomes postion fixed
        container.css('width', expansionPanelCtrl.$element[0].offsetWidth + 'px');

        // set element height so it does not loose its height when container is position fixed
        element.css('height', height + 'px');
        container.css('top', (bottom - height + offset) + 'px');

        element.addClass('md-stick');
        isStuck = true;
      } else if (isStuck === true) {
        unstick();
      }
    }

    function onResize(width) {
      if (isStuck === false) { return; }
      container.css('width', width + 'px');
    }


    function unstick() {
      isStuck = false;
      container.css('width', '');
      container.css('top', '');
      element.css('height', '');
      element.removeClass('md-stick');
    }
  }
}
}());
(function(){"use strict";angular
  .module('material.components.expansionPanels')
  .directive('mdExpansionPanelGroup', expansionPanelGroupDirective);

/**
 * @ngdoc directive
 * @name mdExpansionPanelGroup
 * @module material.components.expansionPanels
 *
 * @restrict E
 *
 * @description
 * `mdExpansionPanelGroup` is a container used to manage multiple expansion panels
 *
 * @param {string=} md-component-id - add an id if you want to acces the panel via the `$mdExpansionPanelGroup` service
 * @param {string=} auto-expand - panels expand when added to `<md-expansion-panel-group>`
 * @param {string=} multiple - allows for more than one panel to be expanded at a time
 **/
function expansionPanelGroupDirective() {
  var directive = {
    restrict: 'E',
    controller: ['$scope', '$attrs', '$element', '$mdComponentRegistry', controller]
  };
  return directive;


  function controller($scope, $attrs, $element, $mdComponentRegistry) {
    /* jshint validthis: true */
    var vm = this;

    var registered = {};
    var panels = {};
    var multipleExpand = $attrs.mdMultiple !== undefined || $attrs.multiple !== undefined;
    var autoExpand = $attrs.mdAutoExpand !== undefined || $attrs.autoExpand !== undefined;


    vm.destroy = $mdComponentRegistry.register({
      $element: $element,
      register: register,
      getRegistered: getRegistered,
      remove: remove,
      removeAll: removeAll
    }, $attrs.mdComponentId);

    vm.addPanel = addPanel;
    vm.expandPanel = expandPanel;
    vm.removePanel = removePanel;


    $scope.$on('$destroy', function () {
      if (typeof vm.destroy === 'function') { vm.destroy(); }
    });


    function addPanel(componentId, panelCtrl) {
      panels[componentId] = panelCtrl;
      if (autoExpand === true) {
        panelCtrl.expand();
        closeOthers(componentId);
      }
    }

    function expandPanel(componentId) {
      closeOthers(componentId);
    }

    function remove(componentId) {
      return panels[componentId].remove();
    }

    function removeAll() {
      Object.keys(panels).forEach(function (panelId) {
        panels[panelId].remove();
      });
    }

    function removePanel(componentId) {
      delete panels[componentId];
    }

    function closeOthers(id) {
      if (multipleExpand === false) {
        Object.keys(panels).forEach(function (panelId) {
          if (panelId !== id) { panels[panelId].collapse(); }
        });
      }
    }


    function register(name, options) {
      if (registered[name] !== undefined) {
        throw Error('$mdExpansionPanelGroup.register() The name "' + name + '" has already been registered');
      }
      registered[name] = options;
    }


    function getRegistered(name) {
      if (registered[name] === undefined) {
        throw Error('$mdExpansionPanelGroup.addPanel() Cannot find Panel with name of "' + name + '"');
      }
      return registered[name];
    }
  }
}
}());
(function(){"use strict";angular
  .module('material.components.expansionPanels')
  .factory('$mdExpansionPanelGroup', expansionPanelGroupService);


/**
 * @ngdoc service
 * @name $mdExpansionPanelGroup
 * @module material.components.expansionPanels
 *
 * @description
 * Expand and collapse Expansion Panel using its `md-component-id`
 *
 * @example
 * $mdExpansionPanelGroup('comonentId').then(function (instance) {
 *  instance.register({
 *    componentId: 'cardComponentId',
 *    templateUrl: 'template.html',
 *    controller: 'Controller'
 *  });
 *  instance.add('cardComponentId', {local: localData});
 *  instance.remove('cardComponentId');
 *  instance.removeAll();
 * });
 */
expansionPanelGroupService.$inject = ['$mdComponentRegistry', '$mdUtil', '$mdExpansionPanel', '$templateRequest', '$rootScope', '$compile', '$controller', '$q'];
function expansionPanelGroupService($mdComponentRegistry, $mdUtil, $mdExpansionPanel, $templateRequest, $rootScope, $compile, $controller, $q) {
  return function (handle) {
    var instance;
    var service = {
      add: add,
      register: register,
      remove: remove,
      removeAll: removeAll
    };

    return $mdComponentRegistry
        .when(handle)
        .then(function (it) {
          instance = it;
          return service;
        });



    function register(name, options) {
      if (typeof name !== 'string') {
        throw Error('$mdExpansionPanelGroup.register() Expects name to be a string');
      }

      validateOptions(options);
      instance.register(name, options);
    }

    function remove(componentId) {
      return instance.remove(componentId);
    }

    function removeAll() {
      instance.removeAll();
    }


    function add(options, locals) {
      locals = locals || {};
      // assume if options is a string then they are calling a registered card by its component id
      if (typeof options === 'string') {
        // call add panel with the stored options
        return add(instance.getRegistered(options), locals);
      }

      validateOptions(options);
      if (options.componentId && instance.isPanelActive(options.componentId)) {
        return $q.reject('panel with componentId "' + options.componentId + '" is currently active');
      }


      var deffered = $q.defer();
      var scope = $rootScope.$new();
      angular.extend(scope, options.scope);

      getTemplate(options, function (template) {
        var element = angular.element(template);
        var componentId = options.componentId || element.attr('md-component-id') || '_panelComponentId_' + $mdUtil.nextUid();
        var panelPromise = $mdExpansionPanel(componentId);
        element.attr('md-component-id', componentId);

        var linkFunc = $compile(element);
        if (options.controller) {
          angular.extend(locals, options.locals || {});
          locals.$scope = scope;
          locals.$panel = panelPromise;
          var invokeCtrl = $controller(options.controller, locals, true);
          var ctrl = invokeCtrl();
          element.data('$ngControllerController', ctrl);
          element.children().data('$ngControllerController', ctrl);
          if (options.controllerAs) {
            scope[options.controllerAs] = ctrl;
          }
        }

        // link after the element is added so we can find card manager directive
        instance.$element.append(element);
        linkFunc(scope);

        panelPromise.then(function (instance) {
          deffered.resolve(instance);
        });
      });

      return deffered.promise;
    }


    function validateOptions(options) {
      if (typeof options !== 'object' || options === null) {
        throw Error('$mdExapnsionPanelGroup.add()/.register() : Requires an options object to be passed in');
      }

      // if none of these exist then a dialog box cannot be created
      if (!options.template && !options.templateUrl) {
        throw Error('$mdExapnsionPanelGroup.add()/.register() : Is missing required paramters to create. Required One of the following: template, templateUrl');
      }
    }



    function getTemplate(options, callback) {
      var template;

      if (options.templateUrl !== undefined) {
        $templateRequest(options.templateUrl)
          .then(function(response) {
            callback(response);
          });
      } else {
        callback(options.template);
      }
    }
  };
}
}());
(function(){"use strict";angular
  .module('material.components.expansionPanels')
  .directive('mdExpansionPanelHeader', expansionPanelHeaderDirective);



/**
 * @ngdoc directive
 * @name mdExpansionPanelHeader
 * @module material.components.expansionPanels
 *
 * @restrict E
 *
 * @description
 * `mdExpansionPanelHeader` is nested inside of `mdExpansionPanelExpanded` and contains content you want in place of the collapsed content
 * this is optional
 *
 * @param {boolean=} md-no-sticky - add this aatribute to disable sticky
 **/
expansionPanelHeaderDirective.$inject = [];
function expansionPanelHeaderDirective() {
  var directive = {
    restrict: 'E',
    transclude: true,
    template: '<div class="md-expansion-panel-header-container" ng-transclude></div>',
    require: '^^mdExpansionPanel',
    link: link
  };
  return directive;



  function link(scope, element, attrs, expansionPanelCtrl) {
    var isStuck = false;
    var noSticky = attrs.mdNoSticky !== undefined;
    var container = angular.element(element[0].querySelector('.md-expansion-panel-header-container'));

    expansionPanelCtrl.registerHeader({
      show: show,
      hide: hide,
      noSticky: noSticky,
      onScroll: onScroll,
      onResize: onResize
    });


    function show() {

    }
    function hide() {
      unstick();
    }


    function onScroll(top) {
      var bounds = element[0].getBoundingClientRect();
      var panelbottom = element[0].parentNode.getBoundingClientRect().bottom;
      var offset = Math.max((top + bounds.height) - panelbottom, 0);

      if (bounds.top < top) {
        // set container width because element becomes postion fixed
        container.css('width', element[0].offsetWidth + 'px');
        container.css('top', (top - offset) + 'px');

        // set element height so it does not shink when container is position fixed
        element.css('height', container[0].offsetHeight + 'px');

        element.removeClass('md-no-stick');
        element.addClass('md-stick');
        isStuck = true;
      } else if (isStuck === true) {
        unstick();
      }
    }

    function onResize(width) {
      if (isStuck === false) { return; }
      element.css('width', width + 'px');
    }


    function unstick() {
      isStuck = false;
      container.css('width', '');
      element.css('height', '');
      element.css('top', '');
      element.removeClass('md-stick');
      element.addClass('md-no-stick');
    }
  }
}
}());