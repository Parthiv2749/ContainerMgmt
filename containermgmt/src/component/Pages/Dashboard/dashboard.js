import React, { useState } from "react";
import { X } from "lucide-react";

const statsInitial = [
  { id: 1, label: "Users", value: 1200 },
  { id: 2, label: "Sales", value: 340 },
  { id: 3, label: "Revenue", value: 89000 },
  { id: 4, label: "Orders", value: 230 },
];

const Dashboard = () => {
  const [stats, setStats] = useState(statsInitial);
  const [editingStat, setEditingStat] = useState(null);
  const [inputValue, setInputValue] = useState("");

  const openEditModal = (stat) => {
    setEditingStat(stat);
    setInputValue(stat.value);
  };

  const closeModal = () => {
    setEditingStat(null);
    setInputValue("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Update the stat value in state
    setStats((prev) =>
      prev.map((stat) =>
        stat.id === editingStat.id ? { ...stat, value: inputValue } : stat
      )
    );
    closeModal();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition"
            onClick={() => openEditModal(stat)}
          >
            <p className="text-gray-500">{stat.label}</p>
            <p className="text-3xl font-semibold mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingStat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
              onClick={closeModal}
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-4">Update {editingStat.label}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-gray-700">Value</label>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(Number(e.target.value))}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                min={0}
              />

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 transition"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
