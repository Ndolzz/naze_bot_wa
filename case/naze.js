async function handleCommand(m, sock) {
  return { handled: false };
}

function getCaseCommands() {
  return {};
}

function getCaseCount() {
  return 0;
}

function getCaseCategories() {
  return [];
}

function getCasesByCategory() {
  return {};
}

export {
  handleCommand,
  getCaseCommands,
  getCaseCount,
  getCaseCategories,
  getCasesByCategory,
};
