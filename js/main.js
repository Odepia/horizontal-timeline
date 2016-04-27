// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;( function( $, window, document, undefined ) {

    "use strict";

        // undefined is used here as the undefined global variable in ECMAScript 3 is
        // mutable (ie. it can be changed by someone else). undefined isn't really being
        // passed in so we can ensure the value of it is truly undefined. In ES5, undefined
        // can no longer be modified.

        // window and document are passed through as local variables rather than global
        // as this (slightly) quickens the resolution process and can be more efficiently
        // minified (especially when both are regularly referenced in your plugin).

        // Create the defaults once
        var pluginName = "horizontalTimeline",
            defaults = {
                firstEventOffset: 60,
                contentOffset: 30,
                endlessStart: false,
                rotate: true,
                height: 100,
                distance: {
                    day: 20,
                    week: 50,
                    month: 130,
                    year: 500
                }
            };

        // The actual plugin constructor
        function Plugin ( element, options ) {
            this.element = element;

            // jQuery has an extend method which merges the contents of two or
            // more objects, storing the result in the first object. The first object
            // is generally empty as we don't want to alter the default options for
            // future instances of the plugin
            this.settings = $.extend( {}, defaults, options );
            this._defaults = defaults;
            this._name = pluginName;
            this.init();
        }

        // Avoid Plugin.prototype conflicts
        $.extend( Plugin.prototype, {
            init: function() {
                var self = this,
                    timeline = $(this.element),
                    template = '<div class="timeline"><div class="events-wrapper"><div class="events"><span class="filling-line" aria-hidden="true"></span></div></div><ul class="cd-timeline-navigation"><li><a href="#" class="prev inactive">Prev</a></li><li><a href="#" class="next">Next</a></li></ul></div><div class="events-content"></div>';
                timeline.append(template);
                timeline.find('ul, ol').eq(0).prependTo( timeline.find('.events') );
                timeline.find('ul, ol').eq(0).prependTo( timeline.find('.events-content') );
                timeline.find('.timeline').css('height', self.settings.height + 'px');

                //cache timeline components 
                self.timelineWrapper = timeline.find('.events-wrapper');
                self.eventsWrapper = self.timelineWrapper.children('.events');
                self.fillingLine = self.eventsWrapper.children('.filling-line');
                self.timelineEvents = self.eventsWrapper.find('a');
                self.timelineDates = self.parseDate(self.timelineEvents);
                self.timelineDistances = self.timelineDistance(self.timelineDates);
                self.timelineNavigation = timeline.find('.cd-timeline-navigation');
                self.eventsContent = timeline.children('.events-content');

                timeline.addClass('cd-horizontal-timeline').addClass('loaded');
                if (self.settings.rotate)
                    self.timelineEvents.addClass('rotate');

                //assign a left postion to the single events along the timeline
                self.setDatePosition();
                //assign a width to the timeline
                var timelineTotWidth = self.setTimelineWidth();
                //the timeline has been initialize - show it

                //detect click on the next arrow
                self.timelineNavigation.on('click', '.next', function(event){
                    event.preventDefault();
                    self.updateSlide(timelineTotWidth, 'next');
                });
                //detect click on the prev arrow
                self.timelineNavigation.on('click', '.prev', function(event){
                    event.preventDefault();
                    self.updateSlide(timelineTotWidth, 'prev');
                });
                //detect click on the a single event - show new event content
                self.eventsWrapper.on('click', 'a', function(event){
                    event.preventDefault();
                    self.timelineEvents.removeClass('selected');
                    $(this).addClass('selected');
                    self.updateOlderEvents($(this));
                    self.updateFilling($(this), self.fillingLine, timelineTotWidth);
                    self.updateVisibleContent($(this), self.eventsContent);
                });

                //on swipe, show next/prev event content
                self.eventsContent.on('swipeleft', function(){
                    var mq = self.checkMQ();
                    ( mq == 'mobile' ) && self.showNewContent(timelineTotWidth, 'next');
                });
                self.eventsContent.on('swiperight', function(){
                    var mq = self.checkMQ();
                    ( mq == 'mobile' ) && self.showNewContent(timelineTotWidth, 'prev');
                });

                //keyboard navigation
                $(document).keyup(function(event){
                    if(event.which=='37' && self.elementInViewport(timeline.get(0)) ) {
                        self.showNewContent(timelineTotWidth, 'prev');
                    } else if( event.which=='39' && self.elementInViewport(timeline.get(0))) {
                        self.showNewContent(timelineTotWidth, 'next');
                    }
                });
            },

            updateSlide: function(timelineTotWidth, string) {
                //retrieve translateX value of self.eventsWrapper
                var self = this,
                    translateValue = self.getTranslateValue(self.eventsWrapper),
                    wrapperWidth = Number(self.timelineWrapper.css('width').replace('px', ''));
                //translate the timeline to the left('next')/right('prev') 
                (string == 'next') 
                    ? self.translateTimeline(translateValue - wrapperWidth / 2, wrapperWidth - timelineTotWidth)
                    : self.translateTimeline(translateValue + wrapperWidth / 2);
            },

            showNewContent: function(timelineTotWidth, string) {
                //go from one event to the next/previous one
                var self = this,
                    visibleContent =  self.eventsContent.find('.selected'),
                    newContent = ( string == 'next' ) ? visibleContent.next() : visibleContent.prev();

                if ( newContent.length > 0 ) { //if there's a next/prev event - show it
                    var selectedDate = self.eventsWrapper.find('.selected'),
                        newEvent = ( string == 'next' ) ? selectedDate.parent('li').next('li').children('a') : selectedDate.parent('li').prev('li').children('a');
                    
                    self.updateFilling(newEvent, self.fillingLine, timelineTotWidth);
                    self.updateVisibleContent(newEvent, self.eventsContent);
                    newEvent.addClass('selected');
                    selectedDate.removeClass('selected');
                    self.updateOlderEvents(newEvent);
                    self.updateTimelinePosition(string, newEvent);
                }
            },

            updateTimelinePosition: function(string, event) {
                //translate timeline to the left/right according to the position of the selected event
                var self = this,
                    eventStyle = window.getComputedStyle(event.get(0), null),
                    eventLeft = Number(eventStyle.getPropertyValue("left").replace('px', '')),
                    timelineWidth = Number(self.timelineWrapper.css('width').replace('px', '')),
                    timelineTotWidth = Number(self.eventsWrapper.css('width').replace('px', ''));
                var timelineTranslate = self.getTranslateValue(self.eventsWrapper);

                if( (string == 'next' && eventLeft > timelineWidth - timelineTranslate) || (string == 'prev' && eventLeft < - timelineTranslate) ) {
                    self.translateTimeline(- eventLeft + timelineWidth/2, timelineWidth - timelineTotWidth);
                }
            },

            translateTimeline: function(value, totWidth) {
                var self = this,
                    eventsWrapper = self.eventsWrapper.get(0);
                value = (value > 0) ? 0 : value; //only negative translate value
                value = ( !(typeof totWidth === 'undefined') &&  value < totWidth ) ? totWidth : value; //do not translate more than timeline width
                self.setTransformValue(eventsWrapper, 'translateX', value+'px');
                //update navigation arrows visibility
                (value == 0 ) ? self.timelineNavigation.find('.prev').addClass('inactive') : self.timelineNavigation.find('.prev').removeClass('inactive');
                (value == totWidth ) ? self.timelineNavigation.find('.next').addClass('inactive') : self.timelineNavigation.find('.next').removeClass('inactive');
            },

            updateFilling: function(selectedEvent, filling, totWidth) {
                //change .filling-line length according to the selected event
                var self = this,
                    eventStyle = window.getComputedStyle(selectedEvent.get(0), null),
                    eventLeft = eventStyle.getPropertyValue("left"),
                    eventWidth = eventStyle.getPropertyValue("width");
                
                eventLeft = Number(eventLeft.replace('px', ''));
                if (self.settings.rotate === false)
                    eventLeft += Number(eventWidth.replace('px', '')) / 2;

                
                if (self.settings.endlessStart == false) {
                    var firstEvent = self.timelineEvents.first(),
                        firstEventLeft = Number(firstEvent.css('left').replace('px', '')),
                        firstEventWidth = self.settings.rotate ? 0 : (Number(firstEvent.css('width').replace('px', '')) / 2),
                        fillingLineOffset = self.settings.rotate ? -7 : 0;
                    eventLeft -= firstEventLeft + firstEventWidth;
                    self.fillingLine.css('left', (firstEventLeft + firstEventWidth + fillingLineOffset) + 'px');
                }

                if (self.settings.endlessStart && self.settings.rotate) {
                    eventLeft -= 7;
                }
                
                var scaleValue = eventLeft/totWidth;
                self.setTransformValue(filling.get(0), 'scaleX', scaleValue);
            },

            setDatePosition: function() {
                var self = this,
                    distances = [self.settings.firstEventOffset].concat(self.timelineDistances),
                    left = 0;

                var eventsWidth = self.timelineEvents.map(function() {
                    return $(this).width();
                });

                for (var i = 0; i < self.timelineDates.length; i++) {
                    var minDistance = (eventsWidth[i] + eventsWidth[i-1] + 10) / 2;
                    var distance = distances[i];
                    if (distance < minDistance && self.settings.rotate === false)
                        distance = minDistance;
                    left += distance;
                    self.timelineEvents.eq(i).css('left', left + 'px');
                }
            },

            setTimelineWidth: function(width) {
                var self = this,
                    totalWidth = self.settings.firstEventOffset * 4 + self.timelineDistances.reduce(function(a, b) { return a + b});
                self.eventsWrapper.css('width', totalWidth+'px');
                self.updateFilling(self.eventsWrapper.find('a.selected'), self.fillingLine, totalWidth);
                self.updateTimelinePosition('next', self.eventsWrapper.find('a.selected'));
            
                return totalWidth;
            },

            updateVisibleContent: function(event, eventsContent) {
                var self = this,
                    eventDate = event.data('date'),
                    visibleContent = eventsContent.find('.selected'),
                    selectedContent = eventsContent.find('[data-date="'+ eventDate +'"]'),
                    selectedContentHeight = selectedContent.height();

                if (selectedContent.index() > visibleContent.index()) {
                    var classEnetering = 'selected enter-right',
                        classLeaving = 'leave-left';
                } else {
                    var classEnetering = 'selected enter-left',
                        classLeaving = 'leave-right';
                }

                selectedContent.attr('class', classEnetering);
                visibleContent.attr('class', classLeaving).one('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(){
                    visibleContent.removeClass('leave-right leave-left');
                    selectedContent.removeClass('enter-left enter-right');
                });
                eventsContent.css('height', selectedContentHeight + self.settings.contentOffset +'px');
            },

            updateOlderEvents: function(event) {
                var self = this;
                event.parent('li').prevAll('li').children('a').addClass('older-event').end().end().nextAll('li').children('a').removeClass('older-event');
            },

            getTranslateValue: function(timeline) {
                var self = this,
                    timelineStyle = window.getComputedStyle(timeline.get(0), null),
                    timelineTranslate = timelineStyle.getPropertyValue("-webkit-transform") ||
                         timelineStyle.getPropertyValue("-moz-transform") ||
                         timelineStyle.getPropertyValue("-ms-transform") ||
                         timelineStyle.getPropertyValue("-o-transform") ||
                         timelineStyle.getPropertyValue("transform");

                if( timelineTranslate.indexOf('(') >=0 ) {
                    var timelineTranslate = timelineTranslate.split('(')[1];
                    timelineTranslate = timelineTranslate.split(')')[0];
                    timelineTranslate = timelineTranslate.split(',');
                    var translateValue = timelineTranslate[4];
                } else {
                    var translateValue = 0;
                }

                return Number(translateValue);
            },

            setTransformValue: function(element, property, value) {
                var self = this;
                element.style["-webkit-transform"] = property+"("+value+")";
                element.style["-moz-transform"] = property+"("+value+")";
                element.style["-ms-transform"] = property+"("+value+")";
                element.style["-o-transform"] = property+"("+value+")";
                element.style["transform"] = property+"("+value+")";
            },

            //based on http://stackoverflow.com/questions/542938/how-do-i-get-the-number-of-days-between-two-dates-in-javascript
            parseDate: function(events) {
                var self = this,
                    dateArrays = [];
                events.each(function(){
                    var singleDate = $(this),
                        dateComp = singleDate.data('date').split('T');
                    if( dateComp.length > 1 ) { //both DD/MM/YEAR and time are provided
                        var dayComp = dateComp[0].split('/'),
                            timeComp = dateComp[1].split(':');
                    } else if( dateComp[0].indexOf(':') >=0 ) { //only time is provide
                        var dayComp = ["2000", "0", "0"],
                            timeComp = dateComp[0].split(':');
                    } else { //only DD/MM/YEAR
                        var dayComp = dateComp[0].split('/'),
                            timeComp = ["0", "0"];
                    }
                    var    newDate = new Date(dayComp[2], dayComp[1]-1, dayComp[0], timeComp[0], timeComp[1]);
                    dateArrays.push(newDate);
                });
                return dateArrays;
            },

            daydiff: function(first, second) {
                var self = this;
                return Math.round(second-first);
            },

            diffs: function(dates) {
                //determine the distance among events
                var self = this,
                    diffs = [];
                for (var i = 1; i < dates.length; i++) { 
                    var distance = self.daydiff(dates[i-1], dates[i]);
                    diffs.push(distance);
                }
                return diffs;
            },

            timelineDistance: function(dates) {
                var self = this,
                    diffs = self.diffs(dates),
                    day = 86400000,
                    week = 8 * day,
                    month = 30 * day,
                    year = 365 * day;

                var limitDistance = function(diff, scale, distance) {
                    var distance = diff / scale * distance;
                    if (distance > scale * 3)
                        return scale * 3;
                    return distance;
                }

                return diffs.map(function(diff) {
                    if (diff >= year) {
                        return limitDistance(diff, year, self.settings.distance.year);
                    } else if (diff >= month) {
                        return limitDistance(diff, month, self.settings.distance.month);
                    } else if (diff >= week) {
                        return limitDistance(diff, week, self.settings.distance.week);
                    } else if (diff >= day) {
                        return limitDistance(diff, day, self.settings.distance.day);
                    } else {
                        return day;
                    }
                });
            },

            /*
                How to tell if a DOM element is visible in the current viewport?
                http://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport
            */
            elementInViewport: function(el) {
                var self = this;
                var top = el.offsetTop;
                var left = el.offsetLeft;
                var width = el.offsetWidth;
                var height = el.offsetHeight;

                while(el.offsetParent) {
                    el = el.offsetParent;
                    top += el.offsetTop;
                    left += el.offsetLeft;
                }

                return (
                    top < (window.pageYOffset + window.innerHeight) &&
                    left < (window.pageXOffset + window.innerWidth) &&
                    (top + height) > window.pageYOffset &&
                    (left + width) > window.pageXOffset
                );
            },

            checkMQ: function() {
                //check if mobile or desktop device
                var self = this;
                return window.getComputedStyle(document.querySelector(self.element), '::before').getPropertyValue('content').replace(/'/g, "").replace(/"/g, "");
            }
        } );

        // A really lightweight plugin wrapper around the constructor,
        // preventing against multiple instantiations
        $.fn[ pluginName ] = function( options ) {
            return this.each( function() {
                if ( !$.data( this, "plugin_" + pluginName ) ) {
                    $.data( this, "plugin_" +
                        pluginName, new Plugin( this, options ) );
                }
            } );
        };

} )( jQuery, window, document );