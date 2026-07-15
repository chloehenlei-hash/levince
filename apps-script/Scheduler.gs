const SQL_SYNC_HANDLER = "sqlScheduledSync";
const SQL_SYNC_TIMEZONE = "Asia/Kuala_Lumpur";

function installSqlSyncTriggers() {
  removeSqlSyncTriggers();
  [[10, 30], [11, 0], [22, 30], [23, 0]].forEach(function (time) {
    ScriptApp.newTrigger(SQL_SYNC_HANDLER)
      .timeBased()
      .atHour(time[0])
      .nearMinute(time[1])
      .everyDays(1)
      .inTimezone(SQL_SYNC_TIMEZONE)
      .create();
  });
  return { ok: true, message: "SQL sync triggers installed." };
}

function removeSqlSyncTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === SQL_SYNC_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function sqlScheduledSync() {
  const result = sqlSyncPaidInvoices();
  PropertiesService.getScriptProperties().setProperty("SQL_SYNC_LAST_RESULT", JSON.stringify({
    ranAt: new Date().toISOString(),
    ok: result.ok,
    uploaded: result.uploaded || [],
    failed: result.failed || []
  }));
  console.log(JSON.stringify(result));
  return result;
}
