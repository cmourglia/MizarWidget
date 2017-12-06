/*******************************************************************************
 * Copyright 2012-2015 CNES - CENTRE NATIONAL d'ETUDES SPATIALES
 *
 * This file is part of MIZAR.
 *
 * MIZAR is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MIZAR is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MIZAR. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
/*global define: false */

/**
 * BackgroundLayersView module
 */
define(["jquery", "underscore-min", "./DynamicImageView", "./PickingManager", "./LayerServiceView", "service/Samp", "./dialog/ErrorDialog", "../utils/UtilsCore", "text!templates/backgroundLayers.html", "jquery.ui"],
    function ($, _, DynamicImageView, PickingManager, LayerServiceView, Samp, ErrorDialog, UtilsCore, backgroundLayersHTML) {

        var nbBackgroundLayers = 0; // required because background id is always equal to 0
        var sky; // TODO: remove sky parameter, use activatedContext instead..
        var parentElement;
        var $el;

        var backgroundDiv;
        var selectedLayer;
        var mizarWidgetAPI;

        /**************************************************************************************************************/

        /**
         *    Update layout of background layer options (HEALPixFITSLayer only for now)
         */
        function updateBackgroundOptions(layer) {
            if ($el.find("#backgroundOptions").is(":visible")) {
                if (UtilsCore.isHipsFitsLayer(layer)) {
                    $el.find("#fitsType").removeAttr('disabled').removeAttr('checked').button("refresh");
                    // Dynamic image view button visibility
                    if (layer.format === 'jpeg') {
                        $el.find('#fitsView').button("disable");
                    }
                }
                else {
                    $el.find("#fitsType").attr('disabled', 'disabled').button("refresh");
                    $el.find('#fitsView').button("disable");
                }

                var $layerServices = $el.find('.layerServices');
                if (!layer.services) {
                    $layerServices.attr('disabled', 'disabled').button('refresh');
                }
                else {
                    $layerServices.removeAttr('disabled').button('refresh');
                }
            }
        }

        /**************************************************************************************************************/

        /**
         *    Create the Html for the given background layer
         */
        function createHtmlForBackgroundLayer(gwLayer) {
            if(gwLayer.type === "WCSElevation" || gwLayer.type === "WMSElevation") {
                // skip it, we do not want to see it in the client
            } else {
                // Add HTML
                var $layerDiv = $('<option ' + (gwLayer.isVisible() ? "selected" : "") + '>' + gwLayer.name + '</option>')
                    .appendTo($el.find('#backgroundLayersSelect'))
                    .data("layer", gwLayer);

                if (gwLayer.icon) {
                    $layerDiv.addClass('backgroundLayer_' + nbBackgroundLayers)
                        .attr("data-style", "background-image: url(" + gwLayer.icon + ")");
                }
                else {
                    // Use default style for icon
                    $layerDiv.addClass('backgroundLayer_' + nbBackgroundLayers)
                        .attr("data-class", "unknown");
                }
                //if (gwLayer.isVisible()) {
                //    // Update background options layout
                //    updateBackgroundOptions(gwLayer);
                //    selectedLayer = gwLayer;
                //    if (gwLayer !== mizarWidgetAPI.getContext().globe.baseImagery) {
                //        //LayerManager.setBackgroundSurvey(gwLayer.name);
                //        mizarWidgetAPI.setBackgroundLayer(gwLayer.name);
                //    }
                //}
                $el.find('#backgroundLayersSelect').iconselectmenu("refresh");
                nbBackgroundLayers++;
            }

        }

        /**************************************************************************************************************/

        /**
         *    Show spinner on loading
         */
        function onLoadStart(layer) {
            $el.find('#backgroundSpinner').fadeIn('fast');
        }

        /**************************************************************************************************************/

        /**
         *    Hide spinner when layer is loaded
         */
        function onLoadEnd(layer) {
            $el.find('#backgroundSpinner').fadeOut('fast');
        }


        /**************************************************************************************************************/

        return {
            /**
             *    Initialization options
             */
            init: function (options) {
                mizarWidgetAPI = options.mizar;
                sky = mizarWidgetAPI.getContext().globe;
                parentElement = options.configuration.element;
                this.updateUI();

                // Background spinner events
                mizarWidgetAPI.subscribeCtx("startBackgroundLoad", onLoadStart);
                mizarWidgetAPI.subscribeCtx("endBackgroundLoad", onLoadEnd);
                mizarWidgetAPI.subscribeCtx("backgroundLayer:change", this.selectLayer);
            },
            remove: function () {
                mizarWidgetAPI.unsubscribeCtx("startBackgroundLoad", onLoadStart);
                mizarWidgetAPI.unsubscribeCtx("endBackgroundLoad", onLoadEnd);
                mizarWidgetAPI.unsubscribeCtx("backgroundLayer:change", this.selectLayer);
                $('#backgroundDiv').dialog("destroy").remove();
                $el.remove();
                nbBackgroundLayers = 0;
            },
            addView: createHtmlForBackgroundLayer,

            /**
             *    Select the give
             *    n layer
             */
            selectLayer: function (layer) {

                // Update selectmenu ui by choosen layer(if called programmatically)
                $el.children().removeAttr("selected");
                var option = _.find($el.children(), function (item) {
                    return item.text === layer.name;
                });
                $(option).attr("selected", "selected");

                selectedLayer = layer;

                // Show background loading spinner
                //$('#loading').show(300);

                // Set shader callback for choosen layer
                if (!_.isEmpty(backgroundDiv)) {
                    backgroundDiv.changeShaderCallback = function (contrast) {
                        if (contrast === "raw") {
                            layer.customShader.fragmentCode = layer.rawFragShader;
                        } else {
                            layer.customShader.fragmentCode = layer.colormapFragShader;
                        }
                    };
                }

                // Change dynamic image view button
                updateBackgroundOptions(layer);

            },

            /**
             *    Create select menu
             *    Synchonize background spinner with background survey events
             */
            updateUI: function () {
                $el = $(backgroundLayersHTML).prependTo($(parentElement));
                // Add custion icon select menu
                $.widget("custom.iconselectmenu", $.ui.selectmenu, {
                    _renderItem: function (ul, item) {
                        var li = $("<li>", {text: item.label});

                        if (item.disabled) {
                            li.addClass("ui-state-disabled");
                        }

                        $("<span>", {
                            style: item.element.attr("data-style"),
                            "class": "ui-icon " + item.element.attr("data-class")
                        }).appendTo(li);

                        return li.appendTo(ul);
                    }
                });

                // Back to sky button if in planet mode
                var self = this;

                if(mizarWidgetAPI.isGroundContext()) {
                    if(mizarWidgetAPI.hasPlanetContext()) {
                        $el.find('.backToSky').button().click(function (event) {
                            mizarWidgetAPI.toggleToSky();
                        });
                    } else {
                        $el.find('.backToSky').hide();
                    }
                    $el.find("#backgroundOptions").hide();
                } else if(mizarWidgetAPI.isPlanetContext()) {
                    if(mizarWidgetAPI.hasSkyContext()) {
                        $el.find('.backToSky').button().click(function (event) {
                            mizarWidgetAPI.toggleToSky();
                        });
                    } else {
                        $el.find('.backToSky').hide();
                    }
                    $el.find("#backgroundOptions").hide();
                } else {
                    // we are in skyContext
                    $el.find('.backToSky').hide();
                    //$el.find('.toggleDimension').hide();

                    $el.find('.layerServices').button({
                        text: false,
                        icons: {
                            primary: "ui-icon-wrench"
                        }
                    }).click(function (event) {
                        LayerServiceView.show(selectedLayer);
                    });

                    $el.find('.exportLayer').button({
                        text: false,
                        icons: {
                            primary: "ui-icon-extlink"
                        }
                    }).click(function (event) {
                        if (Samp.isConnected()) {
                            var healpixLayer = sky.baseImagery;
                            for (var i = 0; i < sky.tileManager.tilesToRender.length; i++) {
                                var tile = sky.tileManager.tilesToRender[i];
                                var url = healpixLayer.getUrl(tile);
                                Samp.sendImage(url);
                            }
                        }
                        else {
                            ErrorDialog.open('You must be connected to SAMP Hub');
                        }
                    });

                    var dialogId = "backgroundDiv";
                    var $dialog = $('<div id="' + dialogId + '"></div>').appendTo('body').dialog({
                        title: 'Image processing',
                        autoOpen: false,
                        show: {
                            effect: "fade",
                            duration: 300
                        },
                        hide: {
                            effect: "fade",
                            duration: 300
                        },
                        width: 400,
                        resizable: false,
                        minHeight: 'auto',
                        close: function (event, ui) {
                            $('#fitsView').removeAttr("checked").button("refresh");
                            $(this).dialog("close");
                        }
                    });

                    // Show/hide Dynamic image service
                    $el.find('#fitsView').button({
                        text: false,
                        icons: {
                            primary: "ui-icon-image"
                        }
                    }).click(function (event) {

                        if ($dialog.dialog("isOpen")) {
                            $dialog.dialog("close");
                        }
                        else {
                            $dialog.dialog("open");
                        }
                    });

                    backgroundDiv = new DynamicImageView(dialogId, {
                        id: 'backgroundFitsView',
                        mizar: mizarWidgetAPI
                    });

                    $el.find('#fitsType')
                        .button()
                        .click(function () {

                            var isFits = $(this).is(':checked');

                            selectedLayer.format = isFits ? 'fits' : 'jpg';
                            if (!isFits) {
                                $('#fitsView').button('disable');
                            }

                            mizarWidgetAPI.setBackgroundLayer(selectedLayer.name);
                            //sky.setBaseImagery(null);
                            //sky.setBaseImagery(selectedLayer);
                            $('#loading').show();
                        });
                }

                $el.find('#backgroundLayersSelect').iconselectmenu({
                    select: function (event, ui) {
                        var index = ui.item.index;
                        var layer = $(this).children().eq(index).data("layer");
                        if (layer !== mizarWidgetAPI.getContext().globe.baseImagery) {
                            mizarWidgetAPI.setBackgroundLayer(layer.name);
                        }
                    }
                }).iconselectmenu("menuWidget")
                    .addClass("ui-menu-icons customicons");
            },
            getDiv: function () {
                return backgroundDiv;
            }
        };

    });
