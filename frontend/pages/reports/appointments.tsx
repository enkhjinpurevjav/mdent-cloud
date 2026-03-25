// Updated table behavior for Ачаалал (LoadTableBlock)

import React from 'react';

const LoadTableBlock = ({ branchFilter, hourLoadDailyData, branchHourLoadDailyData, branchNames }) => {
  // Compute the data based on branch filter
  let data;
  if (!branchFilter) {
    data = hourLoadDailyData;  // Overall combined data
  } else {
    // Use filtered data for the selected branch
    const branchData = branchHourLoadDailyData[branchNames[0]] || {};  // Fallback to empty object if not found
    data = Object.keys(branchData).length > 0 ? branchData : hourLoadDailyData;
  }

  const rows = computeRows(data);

  return (
    <table>
      <thead>
        {/* Render pivot-style columns based on data */}
      </thead>
      <tbody>{renderRows(rows)}</tbody>
    </table>
  );
};

const computeRows = (data) => {
  // Logic to compute hour slots and weighted load percent
  return Object.keys(data).map(hour => {
    const totalFilled = data[hour].fillCount.reduce((sum, curr) => sum + curr, 0);
    const totalPossible = data[hour].possibleCount.reduce((sum, curr) => sum + curr, 0);
    const weightedLoadPercent = totalFilled / totalPossible || 0;
    return { hour, weightedLoadPercent };
  });
};

const renderRows = (rows) => {
  return rows.map(row => (
    <tr key={row.hour}>
      <td>{row.hour}</td>
      <td>{row.weightedLoadPercent.toFixed(2)}</td>
    </tr>
  ));
};

export default LoadTableBlock;