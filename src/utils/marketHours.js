export const isMarketOpen = () => {
  const now = new Date();
  
  // Get time in IST
  // Calculate IST (UTC+5:30)
  // getTimezoneOffset returns minutes from UTC (negative for ahead, positive for behind)
  // We want UTC time first, then add 5.5 hours
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const istTime = new Date(utc + (5.5 * 60 * 60 * 1000));
  
  const day = istTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Monday = 1, Friday = 5
  const isWeekday = day >= 1 && day <= 5;
  
  // 9:15 AM = 9*60 + 15 = 555
  // 3:30 PM = 15*60 + 30 = 930
  const isOpenTime = timeInMinutes >= 555 && timeInMinutes <= 930;

  return isWeekday && isOpenTime;
};
