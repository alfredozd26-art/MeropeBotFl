function searchItemByPartialName(items, searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    return null;
  }
  
  const term = searchTerm.toLowerCase().trim();
  
  const exactMatch = items.find(item => item.name.toLowerCase() === term);
  if (exactMatch) {
    return exactMatch;
  }
  
  const startsWith = items.find(item => item.name.toLowerCase().startsWith(term));
  if (startsWith) {
    return startsWith;
  }
  
  const contains = items.find(item => item.name.toLowerCase().includes(term));
  if (contains) {
    return contains;
  }
  
  return null;
}

function searchItemByPartialNameSync(items, searchTerm) {
  return searchItemByPartialName(items, searchTerm);
}

module.exports = {
  searchItemByPartialName,
  searchItemByPartialNameSync
};
