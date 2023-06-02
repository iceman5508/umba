/**
 * Created by Isaac Parker
 * January 2020
 * Front-end library built for rapid UI/UX driven modular applications.
 */

/**
 * Core init function.
 * This function instantiates all core functions for the library and apply a
 * global class name to the window
 */
(function (window, document) {
    'use strict';

    //use slight singleton to set or get the umba object
    const umba = window.umba || (window.umba = {});

    /**
     * Handles the current dom and virtual dom
     */
    const vdom  = (function () {
        /**
         * Create a virtual dom tree
         * @param template
         */
        function createTree(template) {
            if(typeof template !== 'string'){
                template = JSON.stringify(template);
            }
            let tree;
            try{
                if(template.trim().length > 0 || template.length > 0){
                    template = template.replace(/^\s+|\s+$/gm, '').split('\n').join('');
                    tree = new DOMParser().parseFromString(template,'text/html').body.firstChild;
                }else{
                    tree =new DOMParser().parseFromString('<span></span>','text/html').body.firstChild;
                }

            }catch (e) {
                throw Error('An error occurred, check your template data. We recommend console.log the template data.');
            }

            return {tree: tree};

        }

        /**
         * Mount a current tree to the dom
         * @param template - the template to render
         * @param parentNode - the component to
         */
        function mount(template, parentNode) {
            if(typeof template.tree === 'function'){
                return mountComponent(template, parentNode);
            }else
            if(template.tree){
                return parentNode.appendChild(template.tree);
            }else throw Error('Container Error: no such parentNode found!');
        }

        /**
         * Mount the component to the dom
         * @param vComponent
         * @param parentNode
         */
        function mountComponent(vComponent,parentNode) {
            const {tree, props} = vComponent;

            const instance = new tree(props);

            if(instance instanceof umba.Component){

                const dom = createTree(instance.render());

                instance._dom = dom.tree;

                instance.preLoad();

                instance._dom = mount(dom, parentNode);


                instance.onLoad();

                return instance._dom;

            }


        }

        /**
         * patch the dom with new data
         * @param previousDom - the previous dom
         * @param nextDom - the next dom
         */
        function patch(previousDom, nextDom){
            if(nextDom instanceof Node === false){
                nextDom = createTree(nextDom);
            }
            if(nextDom.tree){
                nextDom = nextDom.tree;
            }

            if(previousDom.nodeName === nextDom.nodeName){
                diff(previousDom, nextDom);
                return previousDom;
            }else{
                previousDom.parentNode.replaceChild(nextDom, previousDom);
                return nextDom;
            }
        }

        /**
         * Generate patch data between the provide doms
         * @param prevDom
         * @param newDom
         */
        function diff(prevDom, newDom) {
            //diff children
            if(prevDom.childNodes.length === newDom.childNodes.length){
                if(newDom.hasChildNodes()){
                    diffChildren(prevDom.childNodes, newDom.childNodes);
                }
            }else{
                prevDom.parentNode.replaceChild(newDom, prevDom);
                diffChildren(prevDom, newDom);
            }
            ///dif attributes
            diffAttrs(prevDom, newDom);
        }

        /**
         * Check if the attributes are the same or not and
         * return the most recent attributes
         * @param oldDom
         * @param newDom
         * @param domNode
         * @return {*}
         */
        function diffAttrs(oldDom, newDom) {
            if(typeof oldDom.getAttributeNames === 'function'){
                let oldAttrs = oldDom.getAttributeNames();
                let newAttrs = newDom.getAttributeNames();

                if(JSON.stringify(oldAttrs)!== JSON.stringify(newAttrs)){
                    Object.keys(newAttrs).forEach((attr) => oldDom.setAttribute(attr, newDom.getAttribute(attr)));
                }else {
                    for(let i=0; i<newAttrs.length; i++){
                        let atrName = newAttrs[i];
                        let old = oldDom.getAttribute(atrName);
                        let neww  = newDom.getAttribute(atrName);
                        if( old !== neww ){
                            if(atrName == 'class'){
                                let newC = neww.split(" ");
                                newC.forEach(c=>{
                                    oldDom.classList.add(c);
                                });
                            }else{
                                oldDom.setAttribute(atrName, neww);
                            }

                        }
                    }
                }
            }


        }

        /**
         * generate patch data for children nodes
         * @param oldChildren
         * @param newChildren
         */
        function diffChildren(oldChildren, newChildren) {
            for(let i=0; i<newChildren.length; i++){
                const nextChild = newChildren[i];
                const prevChild = oldChildren[i];

                if(nextChild.nodeName === '#text' && prevChild.nodeName ==='#text'){
                    patchString(prevChild,nextChild);
                    continue;
                }else{
                    patch(prevChild, nextChild);

                }

            }
        }

        /**
         * Patch the string into the dom
         * @param prevString
         * @param nextString
         */
        function patchString(prevString, nextString) {
            if(prevString !== nextString){
                prevString.nodeValue = nextString.nodeValue;
            }
        }

        return {
            createTree
            ,mount
            ,patch
        }
    })();


    /**
     * keep track of all components
     */
    const components ={};

    /**
     * Provide a name for a component
     * */
    umba.nameComponent = function(name, component, middleware=undefined){
        if(typeof name=='string' && typeof component == 'function'){
            if(!components[name]){
                if(middleware && typeof middleware == "string"){
                    if(middlewares[middleware]){middleware = middlewares[middleware]; }
                }
                components[name] = {component:component, middleware:middleware};
            }

        }else throw TypeError('You must pass a string component name and a valid component');
    };



    /**
     * binding data
     */
    let bindingData = {};


    /**
     * Return binding data or set the data
     * @param key
     * @returns {*}
     */
    umba.binding = function(key=undefined, value=undefined){
        if(!key){
            return bindingData;
        }else
        if(value && typeof value != 'function'){

                umba.module.request.data[key] = value;
                bindingData[key] = value;

        }
        return bindingData[key];
    };

    /**
     * Global object
     * @type {Proxy}
     */
    umba.global = new Proxy({}, {
        set:function (state, key, value) {
            if(typeof value !== 'function'){

                state[key] = value;
                return true;

            }
        }
    });



    /**
     * The function to set the bindings
     * @param bindings: array of data points to bind
     */
    umba.setBindings = function(bindings=[]){
        let binds = [];
        if(Array.isArray(bindings)){
            bindings.forEach(el=>{
                if(typeof el == "string"){
                    binds.push(el);
                    if(bindingData[el]){
                        delete umba.module.request.data[el];
                    }
                    bindingData[el] ='';
                }
            });

            createBind(binds);

        }else throw  TypeError('Your bindings must be an array of strings');
    };

    const createBind = function (binds) {

        let bind = function () {
            binds.forEach(function (data) {
                let elements = document.querySelectorAll(`[data-bind="${data}"]`);

                for (let element of elements) {
                    element.onkeyup = function () {
                        for ( let otherEls of elements) {
                            if(otherEls.tagName == "INPUT"){
                                otherEls.value = this.value;

                            }else{
                                otherEls.textContent = this.value;
                            }
                            bindingData[data] = this.value;

                        }
                    }
                }

                Object.defineProperty( umba.module.request.data, data, {
                    configurable: true
                    ,set: function (newValue) {
                        for (let element of elements) {
                            if(element.tagName == "INPUT"){
                                element.value = newValue;
                            }else{
                                element.textContent = newValue;
                            }

                        }
                    }
                });
            });
        };
        bind(binds);
    };

    /**
     *
     * @param template
     * @param location
     * @param props
     */
    umba.render = function (template, location, props = {}) {
        if(typeof template === 'function'){
            return vdom.mount({tree: template, props: props}, location);
        }else
        if(components[template]){
            let comp = components[template];
            if(comp.middleware){
                if(comp.middleware()==true){
                    return vdom.mount({tree: components[template].component, props: props}, location);
                }
            }
            return vdom.mount({tree: components[template].component, props: props}, location);


        }
        return vdom.mount(vdom.createTree(template),location);
    };

    /**
     * Patch the old dom with the new dom information
     * @type {patch}
     */
    umba.patchDom = vdom.patch;

    /**
     * Internal Pub/Sub patter module
     * @type {{}}
     */
    let eventManager = (function () {
        /**
         * The list of actions to take based on the event name
         * @type {{}}
         */
        let actions = {};

        /**
         * @param eventName
         * @param object
         */
        function on(eventName, object) {

            if(umba.isString(eventName))
            {
                actions[eventName] = actions[eventName] || [];
                actions[eventName].push(object);

            }else
                throw Error('eventName must be a string.');
        }

        /**
         * Trigger an event
         * @param eventName
         * @param data
         *
         */
        function trigger(eventName, data={}) {
            if(actions[eventName] && umba.isString(eventName)){
                let objects = actions[eventName];
                Object.keys(objects).forEach(
                    (instance) => {
                        objects[instance].notify({name: eventName, data:data});
                    });

            }else
                throw Error('No such event exists');
        }

        /**
         * Remove a subscriber from an event
         * @param eventName
         * @param instance
         */
        function remove(eventName, instance){
            if(umba.isString(eventName)){

                let instances =  actions[eventName];
                for(let i=0; i<instances.length; i++){
                    if(instances[i] === instance){
                        actions[eventName].splice(i,1);
                    }
                }
            }
        }

        return {on, trigger, remove}
    })();

    /**
     * Subscribe to a event/message
     * @type {on}
     */
    umba.subscribe = eventManager.on;

    /**
     * Remove a subscriber from an event
     * @type {remove}
     */
    umba.remove = eventManager.remove;

    /**
     * Trigger an event
     * @type {trigger}
     */
    umba.publish = eventManager.trigger;

    /**
     Return request data from a specific key
     * @param key
     * @returns {*}
     */
    umba.data = function(key){
        return umba.module.request.data[key];
    };





    /**
     * serialize the formdata
     */
    umba.serialize = function() {
        let str = [];
        let value = umba.module.request.data;
        for(let p in value)
            if (value.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(value[p]));
            }
        return str.join("&");
    };


    umba.string = {};


    /**
     * Re
     * @param data
     * @param replacement
     */
    umba.string.replaceSpaceWith = function(data, replacement){
        if(typeof data == 'string' && typeof replacement== 'string'){
            return data.replace(/ /g, replacement);
        }
        return data;
    };

    /**
     * Umba string object
     * @type {{}}
     */
    umba.string = new Proxy(umba.string, {
        set:function (state, key, value) {
            throw new TypeError('You cannot alter umba string');
        }
    });





    /**
     * check if the passed variable is a object or not
     * @param o - the value to check if it is a object or not
     * @return {boolean}
     */
    umba.isObject = function(o){
        return (typeof o === 'object' && o !== null);
    };

    /**
     * validate if given data is a number
     * @param data
     * @returns {boolean}
     */
    umba.isNumeric = function (data) {
        let t1 = !Array.isArray( data ) && (data - parseFloat( data ) + 1) >= 0;
        let t2 = !isNaN(parseFloat(data)) && isFinite(data);
        return t2 || t1? true:false;
    };

    /**
     * Validates if the given data is a strict string
     * @param data
     * @returns {boolean}
     */
    umba.isString = function (data){
        if(typeof data === 'string' || data instanceof String){
            if(!umba.isNumeric(data)){
                return true;
            }

        }return false;
    };

    /**
     * validate if given type is boolean or not
     * @param data
     * @returns {boolean}
     */
    umba.isBoolean = function (data) {
        return (typeof(data) == typeof(true));
    };


    /**
     *Stringify the given data
     */
    umba.toString = function(data) {
        return JSON.stringify(data);
    };

    /**
     * Check if the variable is undefined or empty
     * @param variable - the variable name
     * @returns {boolean} - return true or false
     */
    umba.isUndefined = function (variable) {
        if(typeof variable === 'undefined'){
            return true;
        }
        if(!variable ){
            return true;
        }
        if(variable.length < 1){
            return true;
        }
        return false;
    };

    /**
     * Compare two data to see if they are the same
     * @param data1 - first data
     * @param data2 - second data
     * @returns {boolean}
     */
    umba.compareData=function(data1, data2) {
        if(!umba.isUndefined(data1) && !umba.isUndefined(data2)){
            data1 = data1.trim();
            data2 = data2.trim();
            return (data1.toLowerCase().localeCompare(data2.toLowerCase()) == 0? true : false);
        }
        return false;
    };

    /**
     * Check if data given is a valid email address or not
     * @param data
     * @returns {boolean}
     */
    umba.isEmail = function(data) {
        let email = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return email.test(String(data).toLowerCase());
    };

    /**
     * check if data given is a valid social security number or not
     * @param data
     * @returns {boolean}
     */
    umba.isSocial = function(data){
        let  ssn = /^[0-9]{3}\-?[0-9]{2}\-?[0-9]{4}$/;
        return ssn.test(data);
    };

    /**
     * Check if the number given is a valid phone number.
     * Not this was written with US formatted numbers in mind, but some
     * international formats are accepted. Do test different formats before using
     * @param data
     * @returns {boolean}
     */
    umba.isPhone=function(data){
        let  phone =   /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        return phone.test(data);
    };

    /**
     * Match the data format to the given pattern
     * @param data
     * @param pattern
     */
    umba.isPatternMatch=function(data, pattern) {
        let patternArray = pattern.split('');
        let dataArray = data.split('');
        let valid=false;
        if(patternArray.length == dataArray.length){
            for(let i=0; i<patternArray.length; i++){
                let value = dataArray[i];
                if(patternArray[i] == 'n'){
                    if(umba.isNumeric(value)){
                        valid=true;
                    }
                }else if(patternArray[i] == 'a'){
                    if(!umba.isNumeric(value) && value == value.toLowerCase()){
                        valid=true;
                    }
                }else if(patternArray[i] == 'A'){
                    if(!umba.isNumeric(value) && value == value.toUpperCase()){
                        valid=true;
                    }
                }else if(patternArray[i] == value){
                    valid = true;
                }else{
                    valid = false;
                }
                if(!valid){
                    break;
                }

            }
        }
        return valid;
    };


    /**
     * check if string is html or not
     * @param str
     * @returns {boolean}
     */
    umba.isHTML = function(str) {
        let a = document.createElement('div');
        a.innerHTML = str;

        for (let c = a.childNodes, i = c.length; i--; ) {
            if (c[i].nodeType == 1) return true;
        }

        return false;
    };

    /**
     * Check if the passed object is an html element
     * @param o
     * @return {*}
     */
    umba.isElement = function(o){
        return (
            typeof HTMLElement === "object" ? o instanceof HTMLElement :
                o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
        );
    };


    /**
     * Middleware container
     * @type {{}}
     */
    const middlewares = {

    };

    /**
     * Function for creating a new middleware
     */
    umba.createMiddleware = function (name, action){
        if(typeof name == 'string' && typeof action=='function'){
            if(!middlewares[name]) { middlewares[name] = action;}
        }else throw Error('name must be a string and action must be a function');
    };


    /**
     * Get a given middleware or create a middleware and then return it
     * @param name
     * @param action
     */
    umba.middleware = function (name, action) {
        let mw = middlewares[name];
        if(!mw){
            umba.createMiddleware(name,action);
            mw = middlewares[name];

        }
        return mw;
    }

    /***************element control*******************/

    /**
     * Add an element to the page
     * @param parent
     * @param tag
     * @param id
     * @param content
     * The id of the element you are trying to create cannot exist in the dom already.
     */
    umba.addElement = function (parent, tag, id, content) {

        if(document.querySelector(`#${id}`)==null){
            let container = document.querySelector(parent);
            let el = document.createElement(tag);
            el.setAttribute('id',id);
            if(umba.isHTML(content)){
                el.appendChild(content);
            }else {
                el.appendChild(document.createTextNode(content));
            }
            container.appendChild(el);
            return true;
        }
        return false;

    }

    /**
     * Remove an element from the dom
     * @param parent
     * @param element
     */
    umba.removeElement = function (parent, element) {
        parent = document.querySelector(parent);
        element = document.querySelector(element);
        parent.removeChild(element);
    }

    /**
     * Hold default styles of the document.
     * @type {{}}
     */
    const default_styles = {};

    /**
     * Set the style poperties on the page
     * @param styleObject
     * @param keyList - optional array to hold list of keys
     */
    umba.setStyle = function(styleObject = {}){
        let keyList=[];
        for(let key in styleObject){

            if(default_styles[key]){
                if(typeof styleObject[key] == 'string'){
                    document.querySelector(key).style.cssText = styleObject[key];
                }

            }else{
                try{
                    if(typeof styleObject[key] == 'string') {
                        if(!default_styles[key]) {  default_styles[key] = document.querySelector(key).style.cssText; }
                        document.querySelector(key).style.cssText = styleObject[key];
                        keyList.push(key);
                    }
                }catch (e) {
                }
            }
        }
        return keyList;
    }

    /**
     * remove styling on an element or multiple elements
     * @param key
     */
    umba.removeStyle = function (key) {
        if(Array.isArray(key)){
            key.forEach(k=>{
                if(typeof default_styles[k] == "string"){
                    document.querySelector(k).style.cssText = default_styles[k];
                    delete default_styles[k];
                }
            });
        }else if(typeof key== "string"){
            if(default_styles[key]){
                document.querySelector(key).style.cssText = default_styles[key];
                delete default_styles[key];
            }
        }
    }

    /**
     * All all stlying
     */
    umba.clearStyles = function () {
        for(let key in default_styles){
            umba.removeStyle(key);
        }
    }



    /**********methods for copying objects**********/

    /**
     * Create a shallow copy of an object
     * Note if the object being copied has methods those methods will not be copied over
     * @param object
     * @returns {any}
     */
    umba.deepCopy = function (object) {
        return JSON.parse(JSON.stringify(object));
    }


    /**
     * Create a shallow copy of an object
     * Note if this mthod also copies over the methods of the base object
     * @param object
     * @returns {any}
     */
    umba.shallowCopy = function (object) {
        return Object.assign({}, object);
    };

    /**
     * Check if the two items passed in are equal
     * @param i1
     * @param i2
     * @returns {boolean}
     */
    umba.equal = function (i1,i2) {
        if(typeof i1=='object') i1 = JSON.stringify(i1);
        if(typeof i2=='object') i2 = JSON.stringify(i2);
        return i1==i2;
    };


    /***umba core end***/


})(window,document);

(function () {

    /**
     * The umba component class
     * @type {Component}
     */
    umba.Component = class {

        /**
         * Component consturctor
         * @param props
         */
        constructor(props){
            if(new.target === umba.Component){
                throw new TypeError('You must extend the Component class.');
            }

            let self = this;
            this.props = props || {};
            this._dom = undefined;
            this._children = {};
            this._isChild = false;
            this._parent = undefined;
            this._currentState = {};

            /**
             * The state
             * @type {Proxy}
             */
            this.state = new Proxy({}, {
                set:function (state, key, value) {
                    if(typeof value !== 'function'){
                        if(state[key]){
                            state[key] = value;
                            if(self._isChild){
                                self.update();
                            }else
                            if(self._dom !== undefined){
                                if(JSON.stringify(self._currentState[key]) !== JSON.stringify(state[key])){
                                    self._currentState[key] = value;
                                    self.update();
                                }
                            }
                        }else{
                            state[key] = value;
                        }
                        return true;
                    }else {
                        throw new TypeError('The value cannot be a function');
                    }
                }
            });

        }

        /**
         * Render the component
         */
        render(){}

        /**
         * the function to take before the virtual dom is loaded to the actual dom
         * Note that this function has access to the ._dom element which is set by this time.
         */
        preLoad(){
            Object.keys(this._children).forEach((child) =>{
                this._children[child].preLoad();
            });
        }

        /**Function to run after the component is rendered
         * If you overwrite this method it is recommended that you call the parent method first.
         * **/
        onLoad(){
            Object.keys(this._children).forEach((child) =>{
                this._children[child].onLoad();
            });
        }

        /**
         * Run this function after the dom is updated
         *  If you overwrite this method it is recommended that you call the parent method first.
         */
        onUpdate(){
            Object.keys(this._children).forEach((child) =>{
                this._children[child].onUpdate();
            });
        }

        /**
         * Register a given state to the state object
         * @param state
         */
        registerState(state){
            let self = this;
            if(umba.isObject(state)){
                Object.keys(state).forEach((key)=>{
                    self.state[key] = state[key];
                });
            }else
            {
                throw new TypeError('The provided state must be a JSON object');
            }
        }

        /**
         * Subscribe this object to an event
         * @param eventName
         */
        subscribe(eventName){
            umba.subscribe(eventName, this);
        }

        /**
         * Trigger an event
         * @param eventName
         * @param data
         */
        publish(eventName, data){
            umba.publish(eventName, data);
        }

        /**
         * Remove subscription from an event
         * @param eventName
         */
        removeEvent(eventName){
            umba.remove(eventName, this);
        }

        /**
         * Notification function for the pub/sub system
         * @param params
         */
        notify(params){}

        /**
         * Nest a component within another
         * @param component
         * @param props
         */
        childComponent(component, name=undefined, props){
            if(!this._children[name]){
                this._children[name] = new component(props);
                this._children[name]._isChild = true;
                this._children[name]._parent = this;
            }else{

                this._children[name].props =  props || this._children[name].props;
            }
            return this._children[name].render();
        }

        /**
         * Return the first instance of an element that match the given property.
         * Note that is the component is a child the dom used will be the parent dom
         * @param prop
         */
        getElement(prop){
            let result = this.getElements(prop);
            if(result !== undefined){
                return result[0];
            }

            return result;
        }

        /**
         * Return the first instance of an element that match the given property.
         * Note that is the component is a child the dom used will be the parent dom
         * @param prop
         */
        getElements(prop){
            if(this._isChild){
                return this._parent.getElements(prop);
            }else{

                if(typeof this._dom.querySelector === 'function'){

                    let temp = this._dom.querySelectorAll(prop);
                    if((temp === null || temp.length === 0) && this._dom.parentNode) {

                        return this._dom.parentNode.querySelectorAll(prop);
                    }
                    return temp;
                }else if(typeof this._dom.parentNode.querySelector === 'function'){
                    return this._dom.parentNode.querySelectorAll(prop);
                }
                return undefined;

            }
        }

        /**
         * update the element. If it is a child the parent will be updated.
         */
        update(){
            if(this._isChild){
                this._parent.update();
            }else if(this._dom !== undefined && !this._isChild &&this._children !== {}){
                const newDom = this.render();
                this._dom = umba.patchDom(this._dom, newDom);
                this.onUpdate();

            }
        }


        /**
         * Stop a component from executing remaining code. Must be used in the constructor.
         * @returns {{undefined: undefined}}
         */
        abort(){
            return {undefined}
        }



    };

    /**
     * changed the tostring functionality to return components
     * @returns {*}
     */
    umba.Component.prototype.toString = function () {
        return this.render();
    };

    /**
     * add functions to the umba namespace
     * @type {Proxy}
     */
    umba.module = new Proxy({}, {
        set:function (state, key, value) {
            if(typeof value === 'function' || typeof value === 'object'){
                if(!state[key]){
                    state[key] = value;
                    return true;
                }
                throw new TypeError(`Module ${key} already exists!`);

            }
            throw new TypeError('Any additions to module must be a function or object.');
        }
    });



})();


/**
 *DateTime Module
 *
 * For handling and formatting dates and time
 */

umba.module.datetime = (function(){

    /**
     * Return the hours between two give dates
     * @param date1
     * @param date2
     * @returns {number}
     */
    function getHoursBetween(date1, date2){
        return Math.abs(new Date(date1) - new Date(date2)) / 36e5;
    }

    /**
     * Format time to am and pm
     * @param time - the time to format
     * @returns {string} - string of formatted time
     */
    function amPm(time) {
        let date = new Date(time);
        time = date.getHours()+' '+((date.getMinutes()<10)?'0':'')+date.getMinutes();
        let hours = time.substring(0, 2);
        let minutes = time.substring(3, 5);
        let ampm = hours >= 12 ? 'pm' : 'am'; hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        let strTime = hours + ':' + minutes + ' ' + ampm; return strTime;
    }

    /**
     * Return an object with the time that has passed since the passed in date was given
     * @param date - the date to check
     * @returns {string}
     */
    function timeSince(date) {

        date = new Date(date);
        let sinceObject ={};

        let seconds = Math.floor((new Date() - date) / 1000);

        let interval = Math.floor(seconds / 31536000);

        if (interval > 1) {
            sinceObject.years = interval;
        }
        interval = Math.floor(seconds / 2592000);
        if (interval > 1) {
            sinceObject.months =  interval ;
        }
        interval = Math.floor(seconds / 86400);
        if (interval > 1) {
            sinceObject.days =  interval;
        }
        interval = Math.floor(seconds / 3600);
        if (interval > 1) {
            sinceObject.hours =  interval;
        }
        interval = Math.floor(seconds / 60);
        if (interval > 1) {
            sinceObject.minutes =  interval;
        }
        sinceObject.seconds =  Math.floor(seconds);

        return sinceObject;
    }

    /**
     * Return alpha day month year format
     * @param date
     * @returns {string}
     */
    function alpha_dmy(date) {
        date = new Date(date);
        let monthNames = [
            "January", "February", "March",
            "April", "May", "June", "July",
            "August", "September", "October",
            "November", "December"
        ];

        let day = date.getDate();
        let monthIndex = date.getMonth();
        let year = date.getFullYear();

        return day + ', ' + monthNames[monthIndex] + ', ' + year;
    }

    /**
     * Return alpha  month day year format
     * @param date
     * @returns {string}
     */
    function alpha_mdy(date) {
        date = new Date(date);
        let monthNames = [
            "January", "February", "March",
            "April", "May", "June", "July",
            "August", "September", "October",
            "November", "December"
        ];

        let day = date.getDate();
        let monthIndex = date.getMonth();
        let year = date.getFullYear();

        return monthNames[monthIndex] + ' ' + day + ', ' + year;
    }

    /**
     * Return alpha day month year format
     * @param date
     * @returns {string}
     */
    function alpha_dmy2(date) {
        date = new Date(date);
        let monthNames = [
            "January", "February", "March",
            "April", "May", "June", "July",
            "August", "September", "October",
            "November", "December"
        ];

        let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        let day = date.getDay();
        let monthIndex = date.getMonth();
        let year = date.getFullYear();

        return days[day] + ', ' + monthNames[monthIndex] + ' '+date.getDate()+' , ' + year;
    }

    /**
     * Return alpha  month day year format
     * @param date
     * @returns {string}
     */
    function alpha_mdy2(date) {
        date = new Date(date);
        let monthNames = [
            "January", "February", "March",
            "April", "May", "June", "July",
            "August", "September", "October",
            "November", "December"
        ];
        let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        let day = date.getDay();
        let monthIndex = date.getMonth();
        let year = date.getFullYear();

        return monthNames[monthIndex] + ' ' + days[day] +' '+date.getDate()+', ' + year;
    }

    /**
     * Return numeric date in month day year format
     * @param date
     * @returns {string|Date}
     * @constructor
     */
    function numeric_mdy(date){
        let today = new Date(date);
        let dd = today.getDate();
        let mm = today.getMonth()+1;
        let yyyy = today.getFullYear();
        if(dd<10){dd = '0'+dd}
        if(mm<10){mm = '0'+mm}
        today = mm + '/' + dd + '/' + yyyy;
        return today;
    }



    return {
        getHoursBetween
        ,amPm
        ,timeSince
        ,numeric_mdy
        ,alpha_dmy
        ,alpha_dmy2
        ,alpha_mdy
        ,alpha_mdy2

    }

})();

/**
 * Http module for making promised based http request
 */

umba.module.request = (function () {
    function makeRequest (url, options={}) {

        let params = options.params || '';

        if (params && typeof params === 'object') {
            params = Object.keys(params).map(function (key) {
                return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            }).join('&');

            params = '?'+params;

            delete options['params'];
        }

        options.method = options.method || 'GET';

        url = url+params;

        return fetch(url, options).then(function (er) {
            if(!er.ok){
                throw Error(er.statusText);
            }
            return er;
        }).then(res=>res.json());
    }


    return {makeRequest}
})();

/**
 * URL module
 */
umba.module.request.url = (function () {

    /**
     * Return query and hash param values
     * @param name - the name
     * @param url - the url
     * @returns {*}
     */
    function getParam(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(url);
        if (!results) return decodeURIComponent(this.getHashParam(name).replace(/\+/g, ' '));
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    /**
     * Return param value including hash
     * @param name
     * @param url
     */
    function getHashParam(name, url) {
        if (!url) url = window.location.hash.substr(1);

        let result = url.split('&').reduce(function (result, item) {
            let parts = item.split('=');
            result[parts[0]] = parts[1];
            return result;
        }, {});

        return result[name] || undefined;


    }

    /**
     * Return the current page being viewed
     * @returns {*}
     */
    function currentPage() {
        let path =  window.location.pathname;
        return path.split("/").pop();
    }

    /**
     * Return the current url
     */
    function currentUrl() {
        return window.location.href;
    }

    /**
     * Return all hash in the url
     * @returns {string}
     */
    function allHash() {
        return location.hash;
    }

    /**
     * Return the current Host
     * @returns {string}
     */
    function currentHost() {
        return window.location.hostname;
    }

    /**
     * Get the current project folder
     * @returns {*}
     */
    function projectFolder() {
        let pathArray = location.pathname.split('/');
        let appPath = "";
        for(let i=1; i<pathArray.length-1; i++) {
            appPath += pathArray[i] + "/";
        }
        return appPath;
    }

    /**
     * Return the url
     * @returns {string}
     */
    function previousPage() {
        return document.referrer
    }

    /**
     * redirect the url to another location
     * @param url
     */
    function redirect(url) {
        window.location = url;
    }


    return {
        getParam
        ,currentPage
        ,currentUrl
        ,allHash
        ,currentHost
        ,projectFolder
        ,previousPage
        ,redirect
        ,getHashParam
    }

})();

/**
 * Proxy for handling request data
 * @type {{}}
 */
umba.module.request.data = new Proxy({}, {
    set:function (state, key, value) {
        if(typeof value !== 'function'){
            state[key] = value;
            return true;
        }
        throw new TypeError(`Cannot set ${key} to a function`);
    }
});


/**
 * Local Storage Module
 */
umba.module.storage = (
    function(){
        let cookie = false;
        let  runnable = false;
        /**
         * Check if the browser is compatible with
         * the storage method
         */
        function compatible() {
            if (typeof(Storage) !== "undefined") {
                runnable = true;
            } else {
                if(navigator.cookieEnabled){
                    cookie = true;
                    runnable = true;
                }
            }
        }

        compatible();

        /**
         * Create a local storage data
         * @param key - the key
         * @param value - the value
         */
        function put(key, value) {

            if(runnable){
                value = JSON.stringify(value);

                if(cookie){
                    setCookie(key,value, 7);
                }else{
                    localStorage.setItem(key, value);
                }
                return true;
            }else{
                throw Error("Your browser does not support our storage method! Application will not work as expected!");
            }
        }

        /**
         * Return the storage value
         * @param key
         * @returns {*}
         */
        function get(key){
            let item;
            if(runnable){
                if(cookie){
                    item = getCookie(key)
                }else{
                    item = localStorage.getItem(key);
                }
                return JSON.parse(item);
            }else{
                throw Error("Your browser does not support our storage method! Application will not work as expected!");
            }
        }

        /**
         * Remove a storage from memory
         * @param key
         * @returns {boolean}
         */
        function remove(key){
            if(runnable){
                if(cookie){
                    eraseCookie(key);
                }else{
                    localStorage.removeItem(key);
                }
                return true;
            }else{
                throw Error("Your browser does not support our storage method! Application will not work as expected!");
            }
        }

        /**
         * Clear all storage from memory
         * @returns {boolean}
         */
        function clearAll() {
            if(runnable){
                if(cookie){
                    let cookies = document.cookie.split(";");
                    for (let i = 0; i < cookies.length; i++){
                        eraseCookie(cookies[i].split("=")[0]);
                    }

                }else{
                    localStorage.clear();
                }
                return true;
            }else{
                throw Error("Your browser does not support our storage method! Application will not work as expected!");
            }
        }

        /**
         * Check if a specific storgae instance exists
         * @param key
         */
        function exists(key) {
            if(runnable){
                if(cookie){
                    if(getCookie(key) == null){
                        return false;
                    }
                    return true
                }else{
                    if (localStorage.getItem(key) === null) {
                        return false;
                    }
                    return true;
                }
            }else{
                throw Error("Your browser does not support our storage method! Application will not work as expected!");

            }
        }

        function setCookie(name,value,days) {
            let expires = "";
            if (days) {
                let date = new Date();
                date.setTime(date.getTime() + (days*24*60*60*1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "")  + expires + "; path=/";
        }

        function getCookie(name) {
            let nameEQ = name + "=";
            let ca = document.cookie.split(';');
            for(let i=0;i < ca.length;i++) {
                let c = ca[i];
                while (c.charAt(0)==' ') c = c.substring(1,c.length);
                if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
            }
            return null;
        }

        function eraseCookie(name) {
            document.cookie = name+'=; Max-Age=-99999999;';
        }

        return {exists, get, put, remove,  clearAll }
    }
)();

/**
 * client side router module
 */

umba.module.route = class {

    constructor(location) {

        this.routes = [];

        this.container = document.querySelector(location);

        this.currentRoute=undefined;

        this.notfound = "Route Not Found";

        this.clicked = undefined;

        this.styleKeys = [];

        this.currentMiddleware = undefined;

        this.currenthash = undefined;
    }



    /**
     * mark a middleware for a route
     * @param name
     * @param action
     * @param fail - What happens when the route fails to pass
     */
    middleware(name, action=undefined, fail= undefined) {
        let self = this;
        if(typeof fail == "string"){
            let p = fail;
            fail = function () {
                self.navigate(p);
            }
        }else if(typeof fail != "function"){
            fail = function () {
                self.navigate('/');
            }
        }
        this.currentMiddleware = {mw: umba.middleware(name,action), fail:fail};
        return this;
    }

    /**
     * close the middleware guard
     * @returns {close}
     */
    close() {
        this.currentMiddleware = undefined;
        return this;
    }


    /**
     * Get hash fragment
     * @return {string}
     */
    getHash() {
        let self = this;
        let fragment = window.location.hash.substring(1);
        return '/'+self.cleanPath(fragment);
    }

    /**
     * Get the current route
     * @return {string}
     */
    getCurrentRoute() {
        return window.location.hash.substring(1);
    }

    /**
     * Clean the path
     * @param path
     * @return {string}
     */
    cleanPath(path) {
        return path.toString().replace(/\/$/, '').replace(/^\//, '');
    }

    /**
     * Check the route
     * @param route
     * @return {check}
     */
    check(route) {
        this.currenthash = route;
        let self = this;
        let hash2 = route || self.getHash();
        let  keys, match, routeParams;
        for (let i = 0, max = self.routes.length; i < max; i++ ) {
            routeParams = {};
            keys = self.routes[i].path.match(/:([^\/]+)/g);
            match = hash2.match(new RegExp(self.routes[i].path.replace(/:([^\/]+)/g, "([^\/]*)")));
            if (match) {
                let foundRoute = self.routes[i];
                if (self.container.childNodes.length > 0) {
                    self.container.removeChild(self.container.firstChild);
                }
                if (match[0] == match['input']) {

                    if(foundRoute.middleware){
                        let mw = foundRoute.middleware;

                        if(mw.mw() != true){
                            mw.fail();
                            return;
                        }
                    }
                    match.shift();
                    match.forEach(function (value, i) {
                        routeParams[keys[i].replace(":", "")] = value;
                    });

                    if (typeof foundRoute.action == 'string') {
                        umba.render(foundRoute.action, self.container, routeParams);
                    } else {
                        foundRoute.action.call({}, routeParams,self.container);
                    }

                    window.location.href = '#' + route;
                    return;
                }else{
                    self.currentRoute = undefined;
                    umba.render(self.notfound, self.container);
                }
            }
        }

    }

    /**
     * Apply the stle for a specific route
     */
    applyStyle(styleObject){
        let self = this;
        self.styleKeys = umba.setStyle(styleObject);
    }

    /**
     * Remove style
     */
    removeStyle() {
        let self = this;
        umba.removeStyle(self.styleKeys);
    }

    /**
     * Add a route to the router
     * @param path - the path
     * @param action - the function to run
     * @returns {add} - the router object
     */
    add (path ='', action) {
        let self = this;
        if(typeof path != 'string'){
            throw Error('You must provide a valid path');
        }

        if(typeof action != 'function' && typeof action != 'string'){
            throw Error('You must provide a valid action function or component name');
        }


        if(self.currentMiddleware){
            self.routes.push({ path: path, action: action, middleware: self.currentMiddleware});
        }else{
            self.routes.push({ path: path, action: action,  middleware: undefined});
        }

        return this;

    }

    /**
     * Set active route*/
    setActiveRoute() {
        let self = this;
        let cr = self.getCurrentRoute();
        if(cr.trim().length == 0){
            cr = "/";
        }


        try{
            if(cr!==self.clicked && self.clicked!=undefined){
                self.currentRoute.classList.remove('active');
            }
            self.currentRoute =  document.querySelector(`[route="${cr}"]`);
            self.currentRoute.classList.add('active');
        }catch(e){}

    }

    /**
     * Set the navigation for the routes
     */
    setRouteNav(){
        let self=this;
        document.querySelectorAll('[route]').forEach(route => route.addEventListener('click',e => {
            e.preventDefault();
            if(self.currentRoute != e.target) {
                if (self.currentRoute !== undefined && self.currentRoute !== null) {
                    self.currentRoute.classList.remove("active");
                }


                self.currentRoute = e.target;
                self.currentRoute.classList.add("active");
                self.clicked = self.currentRoute.getAttribute('route');
                self.check(self.clicked);

            }


        }, false));
    }

    /**
     * This method is required  after adding all routes
     * @returns {run}
     */
    run(fof=undefined, wait = false) {
        let self = this;
        if(fof && typeof fof=='string'){
            self.notfound = fof;
        }

        if(wait==true){
            document.addEventListener('DOMContentLoaded', e => {
               self.setRouteNav();
            });
        }else{
            self.setRouteNav();
        }


        self.setActiveRoute();
        self.removeStyle();
        self.check(self.getHash());
        window.onhashchange = function () {
            if(self.currenthash != self.getHash()){
                self.setActiveRoute();
                self.removeStyle();
                self.check(self.getHash());
            }

        }
        return this;
    }

    /**
     * Navigate to another route
     * @param route
     */
    navigate(route) {
        if(typeof route == 'string'){
            window.location.href = '#'+route;
        }
    }


};

/**
 * umba form module
 * Used to handle forms and their data
 * This module relies on the request module
 */

umba.module.form = (
    function () {
        class form{

            /**
             * Init the form class, pass in the id of the form or the form element itself
             * @param formName
             */
            constructor(formName){
                let self =this;
                this.thenObj = [];
                this.finalObj = {};
                this.element = undefined;


                if(typeof formName === 'string'){
                    this.element = document.querySelector(`[name="${formName}"]`) || undefined;
                    if(!this.element)
                        throw Error('Must enter a valid form name');
                }else{
                    throw Error('Must enter a valid form name');
                }


                this.element.onsubmit = function(event){
                    umba.module.request.data = {};

                    event.preventDefault();
                    let elements = self.element.querySelectorAll("input, select, checkbox, textarea, button");
                    elements.forEach((element)=>{
                        let key = element.getAttribute('name') || element.getAttribute('id');
                        umba.module.request.data[key] = (element.type==='checkbox' )? element.checked : element.value || element.textContent;

                    });

                    self.thenObj.forEach(action =>{
                        action(umba.module.request.data);
                    });

                    if(self.finalObj['final']){
                        self.finalObj['final'](umba.module.request.data);
                    }
                }
            }

            /**
             * The then action take after the init.
             * This function can be chained
             * The then function is pass the current form object
             * @param action
             * @return {form}
             */
            then(action){
                if(action&& typeof action == 'function'){
                    this.thenObj.push(action);
                }
                return this;
            }

            /**
             * The final action to take after every action has been taken.
             * This function can not be chained
             * The final function is pass the current form object
             * @param action
             * @return {form}
             */
            final(action){
                if(action&& typeof action == 'function'){
                    this.finalObj['final'] = action;
                }
                return this;
            }
        }

        /**Set the toString of the form object**/
        form.prototype.toString = function() {
            return JSON.stringify(umba.module.request.data);
        };
        return form;
    }
)();

/***
 Validation module
 This module is used to validate data
 **/
umba.module.validate = function (data={}, rules={}) {

    if(typeof data !='object' && typeof rules != 'object'){
        throw TypeError('Must enter valid data and rules');
    }

    let valid = true;
    let errors = {};
    let el = undefined;

    /**
     * Get all the validation properties
     */
    function validate(){
        for(let key in rules){
            errors[key] = [];
            let rule = rules[key];
            let rule_array = rule.split('|');

            rule_array.forEach(function(r) {
                let tup = r.replace(' ', '').trim().split(':');

                let k = tup[0].trim(); let v = tup[1].replace(' ','').trim();

                check(k,v,key);

            });


            errors[key]['first'] = function () {
                return  errors[key].length > 0 ? errors[key][0] : ' ';
            };


            el=undefined;

        }

    }


    function markError(el,error) {
        if(el!=undefined){
            if(error){
                el.classList.add("is-invalid");
            }else if(!error){
                el.classList.remove("is-invalid");
            }
        }
    }


    /**
     * Check if the data point match the given value or not
     */
    function check(key, value, name) {
        let d = data[name];
        if (el == undefined) {
            try { el = document.querySelector(`[name="${name}"]`); } catch (e) {}
        }

        switch (key) {
            case 'max':
                if (!maxCheck(d, value)) {
                    errors[name].push(`${name} has more chars than the max of ${value}.`);
                    valid = false;
                    markError(el,true);
                }else{
                    markError(el,false);
                }
                break;
            case 'min':
                if (!minCheck(d, value)) {
                    errors[name].push(`${name} must be at least ${value} chars.`);
                    valid = false;
                    markError(el,true);
                }else{
                    markError(el,false);
                }
                break;
            case 'type':
                if (!typeCheck(d, value.toLowerCase())) {
                    errors[name].push(`${name} is expected to be of type ${value}.`);
                    valid = false;
                    markError(el,true);
                }else{
                    markError(el,false);
                }
                break;
            case 'expecting':
                if (!patternCheck(d, value.toLowerCase())) {
                    errors[name].push(`${name} is expected to be a valid ${value}.`);
                    valid = false;
                    markError(el,true);
                }else{
                    markError(el,false);
                }
                break;
            case 'match':
                if (!matchCheck(d, value)) {
                    errors[name].push(`${name} does not match the ${value} field.`);
                    valid = false;
                    markError(el,true);
                }else{
                    markError(el,false);
                }
                break;
            case 'pattern':
                if (!myPatternCheck(d, value)) {

                    errors[name].push(`${name} is expected to be in a format as such: ${value}`);
                    valid = false;
                    markError(el,true);
                }else{
                    markError(el,false);
                }
                break;
            default:
                break;
        }
    }



    /**
     * check if the data meets the maximum requirement
     * return true if it did and false if it does not
     */
    function maxCheck(data, max) {
        return data.length <= max;
    }


    /**
     * check if the data meets the minimum requirement
     * return true if it did and false if it does not
     */
    function minCheck (data, min) {
        return data.length >= min;
    }


    /**
     * check if the data passed for being particular dataType or not
     * return true if it did and false if it does not
     */
    function typeCheck(data, dataType) {
        switch (dataType) {
            case 'string':
                return umba.isString(data);
                break;
            case 'number':
                return umba.isNumeric(data);
                break;
            case 'boolean':
                return umba.isBoolean(data);
                break;
            default:
                return false;
                break;

        }

    }


    /**
     * check if the data passed for being a particular pattern or not
     * return true if it did and false if it does not
     */
    function patternCheck(data, pattern) {
        switch (pattern) {
            case 'email':
                return umba.isEmail(data);
                break;
            case 'ssn':
                return umba.isSocial(data);
                break;
            case 'phone':
                return umba.isPhone(data);
                break;
            default:
                return false;
                break;
        }

    }



    /**
     * check if the data passed for matching another field or not
     * return true if it did and false if it does not
     */
    function matchCheck(value, fieldname) {
        return umba.compareData(value, data[fieldname]);
    }


    /**
     * Check if the data matches the pattern provided
     * @param data
     * @param pattern
     * @returns {*}
     */
    function myPatternCheck(data, pattern) {
        return umba.isPatternMatch(data, pattern);
    }


    validate();
    return {valid,errors};

};

/***
 * Set facads for the core modules
 */
umba.datetime = umba.module.datetime;

umba.request = umba.module.request;

umba.url = umba.module.request.url;

umba.storage = umba.module.storage;

umba.route = umba.module.route;

umba.form = umba.module.form;

umba.validate = umba.module.validate;



/**
 * Ensure that umba can not be altered
 * @type {Proxy}
 */
umba = new Proxy(window.umba, {
    set:function (state, key, value) {
        throw new TypeError('You cannot alter umba');
    }
});

Object.seal(umba);
Object.freeze(umba.Component);
