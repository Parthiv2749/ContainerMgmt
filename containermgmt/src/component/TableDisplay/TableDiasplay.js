import "./TableDispla.css"
import axios from "axios";

import React, { useState, useMemo } from "react";
import { Pencil, Trash, Settings, Filter, X, Plus, Mail } from "lucide-react";

const InvoiceTable = ({ columns, rows, addDataComponent = false, title, onDataChange  }) => {
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const [isSettingsPopupOpen, setIsSettingsPopupOpen] = useState(false);
  const [isMailsPopupOpen, setIsMailsPopupOpen] = useState(false);
  const [isAddDataPopupOpen, setIsAddDataPopupOpen] = useState(false);
  const [filterColumn, setFilterColumn] = useState(columns[0]?.key || "");
  const [filterValue, setFilterValue] = useState("");
  
  const [tempVisibleColumns, setTempVisibleColumns] = useState(
    columns.reduce((acc, col) => ({ ...acc, [col.key]: true }), {})
  );
  
  const [editRow, setEditRow] = useState(null);  // <- track which row is being edited
  const [selectedDate, setSelectedDate] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(tempVisibleColumns);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const handleColumnToggle = (key) => {
    setTempVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = () => {
    setVisibleColumns(tempVisibleColumns);
    setIsSettingsPopupOpen(false);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return rows;
    return [...rows].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [sortConfig, rows]);

  const filteredData = useMemo(() => {
    return sortedData.filter((row) =>
      row[filterColumn]?.toString().toLowerCase().includes(filterValue.toLowerCase())
    );
  }, [filterColumn, filterValue, sortedData]);

  const incompleteData = filteredData.filter(row => row.status !== "Complete");
  const completeData = filteredData.filter(row => row.status === "Complete");


  const handleEditClick = async (row) => {
    try {
      const response = await axios.get(`http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/getContainerDetails/${row.container_id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });

      let data = response.data;
      console.log("Fetched data for edit:", data.documents);
      if (typeof data === "string") data = JSON.parse(data);

      setEditRow(data);  // Send full API-fetched data to the form
      setIsAddDataPopupOpen(true);
    } catch (error) {
      console.error("Failed to fetch container details:", error);
      alert("Could not load container details");
    }
  };

  const handleDeleteClick = async (row) => {
    if (!window.confirm("Are you sure you want to delete this row?")) return;

    try {
      const response = await axios.delete(`http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/deleteContainerDetails/${row.container_id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });

      if (response.status === 200) {
        // getContainerData();
        // onDataChange();
        alert("Row deleted successfully");

        if (typeof onDataChange === "function") {
          onDataChange();
        }
        // Optionally, refresh the data or remove the row from state
      } else {
        alert("Failed to delete row");
      }
    } catch (error) {
      console.error("Failed to delete row:", error);
      alert("Error deleting row");
    }
  }

  const handlePickupEmail = async () => {
    if (!selectedDate) {
      alert("Please select a date before sending the email.");
      return;
    }

    try {
      const response = await axios.get(`http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/arrived`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        params: { date: selectedDate },  // 👈 pass as query parameter
      });

      const containers = response.data;

      if (!containers.length) {
        alert("No arrived containers found.");
        return;
      }

      const subject = "Pickup Request for Arrived Containers";
      let body = "Please arrange pickup for the following containers:\n\n";

      containers.forEach((c, i) => {
        body += `${i + 1}. Container: ${c.container_no}\n   Location: ${c.emptied_at}\n   Arrival: ${c.empty_date}\n\n`;
      });

      const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;

    } catch (err) {
      console.error("Failed to fetch container data:", err);
      alert("Error fetching container data.");
    }
  };


  const handleDropoffEmail = async () => {
    if (!selectedDate) {
      alert("Please select a date before sending the email.");
      return;
    }

    try {
      const response = await axios.get(`http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/arrived`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        params: { date: selectedDate },  // 👈 pass as query parameter
      });

      const containers = response.data;

      if (!containers.length) {
        alert("No containers found to drop.");
        return;
      }

      const subject = "Pickup Request for Arrived Containers";
      let body = "Please arrange pickup for the following containers:\n\n";

      containers.forEach((c, i) => {
        body += `${i + 1}. Container: ${c.container_no}\n   Location: ${c.emptied_at}\n   Arrival: ${c.arrival_on_port}\n\n`;
      });

      const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;

    } catch (err) {
      console.error("Failed to fetch container data:", err);
      alert("Error fetching container data.");
    }

  };


  return (

    <div className=" relative " disabled={true}>
      <div className="flex justify-between mb-2 pr-2">
        <button className="p-2 border rounded bg-black text-white flex items-center" onClick={() => setIsAddDataPopupOpen(!isAddDataPopupOpen)}>
          <Plus className="w-5 h-5 mr-1" /> Add Data
        </button>
        <div className="flex space-x-2">
          <button className="p-2 border rounded" onClick={() => setIsMailsPopupOpen(!isMailsPopupOpen)}>
            <Mail className="w-5 h-5" />
          </button>          
          <button className="p-2 border rounded" onClick={() => setIsFilterPopupOpen(!isFilterPopupOpen)}>
            <Filter className="w-5 h-5" />
          </button>
          <button className="p-2 border rounded " onClick={() => setIsSettingsPopupOpen(!isSettingsPopupOpen)}>
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isMailsPopupOpen && (
        <div className="absolute right-0 mr-2 bg-white border p-4 shadow-md z-50 w-64 rounded">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">send Email</h3>
            <button onClick={() => setIsMailsPopupOpen(false)}><X className="w-5 h-5" /></button>
          </div>
          <hr/>
          {/* Date picker input */}
          <label className="block mb-3">
            <span className="text-sm font-medium">Select Date</span>
            <input
              type="date"
              className="mt-1 block w-full border rounded px-2 py-1"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>

          <button
            onClick={handlePickupEmail}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-2"
          >
            Pick Up
          </button>
          <button
            onClick={handleDropoffEmail}
            className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Drop Off
          </button>
        </div>
      )}     

      {isFilterPopupOpen && (
        <div className="absolute right-0 mr-2 bg-white border p-4 shadow-md z-50 w-64 rounded">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Filter</h3>
            <button onClick={() => setIsFilterPopupOpen(false)}><X className="w-5 h-5" /></button>
          </div>
          <hr/>
          <select className="w-full p-2 border mb-2" value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)}>
            {columns.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
          </select>
          <input
            type="text"
            className="w-full p-2 border mb-2"
            placeholder="Filter value"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
        </div>
      )}

      {isSettingsPopupOpen && (
        <div className="absolute right-0 mr-2 bg-white border p-4 shadow-md z-50 w-48 rounded">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold"> Visibility</h3>
            <button onClick={() => setIsSettingsPopupOpen(false)}><X className="w-5 h-5 " /></button>
          </div>
          <hr/>
          {columns.map(col => (
            <label key={col.key} className="flex items-center space-x-1 mb-1">
              <input
                type="checkbox"
                checked={tempVisibleColumns[col.key]}
                onChange={() => handleColumnToggle(col.key)}
              />
              <span>{col.label}</span>
            </label>
          ))}
          <button className="w-full p-2 bg-black text-white mt-2" onClick={handleSaveSettings}>Save</button>
        </div>
      )}

      {isAddDataPopupOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          {/* Modal Container */}
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">{title}</h2>
                <button
                  onClick={() => {
                    setIsAddDataPopupOpen(false);
                    setEditRow(null); // <-- clears edit state
                  }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
            </div>

            {/* Scrollable Form Container */}
          <div className="overflow-y-auto p-4 flex-1">
            {addDataComponent
              ? React.createElement(addDataComponent, { editData: editRow,       onFormSubmit: () => {
                  setIsAddDataPopupOpen(false);
                  setEditRow(null);
                  // if (typeof onDataChange === "function") onDataChange(); // optional: refresh parent data
                }
              })
              : null}
          </div>


          </div>
        </div>
      )}
      

      <div className="customParentTableClass TableClass relative max-h-[calc(44vh)] overflow-auto border border-gray-300 pr-2 mb-1">
        <table className="w-full table-auto border-collapse max-h-full">
          <thead className="sticky top-0 bg-black text-white z-10 text-center">
            <tr>
              {columns.filter(col => !col.hidden && visibleColumns[col.key]).map(col => (
                <th key={col.key} className="px-4 py-2 cursor-pointer" onClick={() => handleSort(col.key)}>
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {incompleteData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100">
                {columns.filter(col => !col.hidden && visibleColumns[col.key]).map(col => (
                  <td key={col.key} className="px-4 py-2 text-center">{row[col.key]}</td>
                ))}
                <td className="px-4 py-2 flex justify-center space-x-2">
                  <button
                    className="p-1 text-blue-500"
                    onClick={() => {
                      handleEditClick(row) // Set selected row for editing
                      setIsAddDataPopupOpen(true); // Open modal
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button className="p-1 text-red-500"
                                        onClick={() => {
                      handleDeleteClick(row); // Set selected row for editing
                      // setIsAddDataPopupOpen(true); // Open modal
                    }}
                    >
                    <Trash className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="h-12"></div> {/* Spacer to add bottom margin */}
      </div>

      <div className="customParentTableClass TableClass relative max-h-[calc(44vh)] overflow-auto border border-gray-300 pr-2 mb-2">
        <table className="w-full table-auto border-collapse max-h-full">
          <thead className="sticky top-0 bg-black text-white z-10 text-center">
            <tr>
              {columns.filter(col => !col.hidden && visibleColumns[col.key]).map(col => (
                <th key={col.key} className="px-4 py-2 cursor-pointer" onClick={() => handleSort(col.key)}>
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {completeData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100">
                {columns.filter(col => !col.hidden && visibleColumns[col.key]).map(col => (
                  <td key={col.key} className="px-4 py-2 text-center">{row[col.key]}</td>
                ))}
                <td className="px-4 py-2 flex justify-center space-x-2">
                  <button
                    className="p-1 text-blue-500"
                    onClick={() => {
                      handleEditClick(row) 
                      setIsAddDataPopupOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button className="p-1 text-red-500"><Trash className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="h-12"></div>
      </div>     

      
    </div>
    
  );
};

export default InvoiceTable;