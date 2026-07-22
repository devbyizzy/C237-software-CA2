window.RPCCA = window.RPCCA || {};

(function() {
  'use strict';

  var categoryConfigs = [
    {
      keywords: ['sports', 'athletics', 'games'],
      gradient: ['#534AB7', '#378ADD', '#7F77DD'],
      icon: 'ti-ball-bowling'
    },
    {
      keywords: ['arts', 'art', 'music', 'photo', 'paint', 'drama', 'dance', 'culture'],
      gradient: ['#993556', '#D4537E', '#F0997B'],
      icon: 'ti-camera'
    },
    {
      keywords: ['technology', 'tech', 'robotics', 'coding', 'engineering', 'it', 'computing'],
      gradient: ['#0F6E56', '#1D9E75', '#5DCAA5'],
      icon: 'ti-robot'
    },
    {
      keywords: ['social', 'community', 'service', 'volunteer', 'student life', 'life'],
      gradient: ['#3A3A5C', '#5A5A7A', '#8A8AAA'],
      icon: 'ti-users'
    }
  ];

  var defaultGradient = ['#3A3A5C', '#5A5A7A', '#8A8AAA'];
  var defaultIcon = 'ti-star';

  function matchCategory(category) {
    if (!category) return { gradient: defaultGradient, icon: defaultIcon };
    var key = String(category).trim().toLowerCase();
    for (var i = 0; i < categoryConfigs.length; i++) {
      var cfg = categoryConfigs[i];
      for (var j = 0; j < cfg.keywords.length; j++) {
        if (key === cfg.keywords[j] || key.indexOf(cfg.keywords[j]) !== -1) {
          return { gradient: cfg.gradient, icon: cfg.icon };
        }
      }
    }
    return { gradient: defaultGradient, icon: defaultIcon };
  }

  window.RPCCA.getCategoryTheme = function(category) {
    return matchCategory(category);
  };

  window.RPCCA.categoryConfigs = categoryConfigs;
  window.RPCCA.defaultGradient = defaultGradient;
  window.RPCCA.defaultIcon = defaultIcon;
})();
