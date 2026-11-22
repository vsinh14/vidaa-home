/* Module 80 — assembly.
 *
 * create(sdk) is the whole public surface: native-entry.js swaps the
 * returned options into the stock launcher's /Launcher route. Every
 * module contributes a slice (model, lifecycle, settings, keys), merged
 * into one methods bag — the Vue options contract is per-component, so
 * the modularity lives at authoring time and the vendor engine still
 * gets exactly one component factory, as before.
 *
 * kit holds the two singletons (sdk and its key maps): one launcher
 * page per page, created once, so no per-instance plumbing is needed.
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;

  function create(sdk) {
    if (!sdk) throw new Error("sdk is required");
    kit.installKeys(sdk);
    return {
      name: "Launcher", // The shared shell's keep-alive list uses this name.
      data: kit.model.data,
      mounted: function () { this.start(); },
      activated: function () { this.readPrefs(); this.start(); this.routeFocus(); },
      deactivated: function () { this.stop(); },
      beforeDestroy: function () { this.stop(); },
      watch: {
        "$route": function () { this.routeFocus(); }
      },
      methods: kit.merge({},
        kit.model.methods,
        kit.lifecycle.methods,
        kit.settings.methods,
        kit.keyActions.methods
      ),
      render: function (h) { return kit.renderAll(this, h); }
    };
  }

  // Two names for one factory: the trial entry looks for the component,
  // the alvidaa lane names it after the product it replaces.
  self.AlvidaaNativeHome = create;
  self.AlvidaaNativeComponent = create;
}(self));
