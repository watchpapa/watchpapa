
export function isValidDateStr(dateStr) {
  
    // Check if the input is a string
  if (typeof dateStr !== "string") {
    return false;
  }
    // Check if the input matches the YYYY-MM-DD format
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }
  
  // Split the date string into its components
  const [year, month, day] = dateStr.split("-").map(Number);

    // Check if the month is valid (1-12)
    if (month < 1 || month > 12) {
    return false;
  }

    // Check if the day is valid for the given month and year
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return false;
  }

  return true;
}