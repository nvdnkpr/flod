var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var uuid = require('node-uuid');

var Statistics = module.exports = function () {
  
};

Statistics.prototype.initStatistics = function () {

  this.benchmark = null; // stores the current benchmark
  this._startTime = null; // stores start time while other code might still be starting up
};

Statistics.prototype.now = function () {

  return Date.now() / 1000 >> 0;
};

Statistics.prototype.register = function (query) {

  var id = query.id || uuid.v4();
  if (this.benchmark !== null) {
    return "Benchmark in progress, please wait until finished";
  }
  
  delete query.id;
  this.benchmark = {
    id: id,
    query: query
  };
  
  if (this._startTime !== null) {
    this.benchmark['started'] = this._startTime;
    this._startTime = null;
  }
  
  return this.benchmark;
}

Statistics.prototype.unregister = function (id) {

  if (id == null || 
      (this.benchmark && this.benchmark.id && this.benchmark.id != id)) {
    return "No such benchmark found by that id (" + id + ")";
  }
  
  benchmark = this.finalizeData();
  stats = this.statistics(benchmark);
  return stats;
}

Statistics.prototype.finalizeData = function () {

  var benchmark = this.benchmark;
  this.benchmark = null;
  this.backupToFile(benchmark);
  
  return benchmark;
}


Statistics.prototype.aggregate = function (action, ts, id, value) {

  if (value == null) {
    value = 1;
  }
  
  if (this.benchmark == null || this.benchmark.id !== id) {
    return null;
  }
  
  if (!this.benchmark.hasOwnProperty(action)) {
    this.benchmark[action] = {};
  }
  
  if (!this.benchmark[action].hasOwnProperty(ts)) {
    this.benchmark[action][ts] = 0;
  }
  
  return this.benchmark[action][ts] += value;
}

Statistics.prototype.record = function (action, ts, data) {

  if (this.benchmark == null) {
    return null;
  }
  
  if (!this.benchmark.hasOwnProperty(action)) {
    this.benchmark[action] = {};
  }
  
  return this.benchmark[action][ts] = data;
}

Statistics.prototype.set = function (action, data) {

  if (this.benchmark == null) {
    return null;
  }
  
  return this.benchmark[action] = data;
}

Statistics.prototype.onMessage = function (m) {

  var ts = this.now();
  switch (m.action) {
    case 'request':
      return this.aggregate(m.action, ts, m.data);
    case 'mem':
    case 'load':
      return this.record(m.action, ts, m.data);
    case 'started':
      return this._startTime = ts;
    case 'ended':
      return this.set(m.action, ts);
    default:
      throw "unspecified action supplied to Daemon::Statistics: " + m.action;
  }
}

Statistics.prototype.pollMetrics = function () {

  if (this.server && this.server.send) {
    this.server.send({
      action: 'mem'
    });
    
    this.server.send({
      action: 'load'
    });
  }
}

///////////////////
// Backup Related
///////////////////

Statistics.prototype.backupFilename = function () {

  return "bench-" + this.now() + ".json";
}

Statistics.prototype.backupToFile = function (contents) {
  if (contents == null) {
    return;
  }
  
  var backupFilename = path.join(this.options.rootPath || __dirname, this.options.logPath, this.backupFilename());
  fs.writeFileSync(backupFilename, JSON.stringify(contents));
}