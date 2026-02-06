"use client";

import { FuelKind } from "@/lib/types";

type ControlsProps = {
  fuel: FuelKind;
  setFuel: (value: FuelKind) => void;
  sortCheapest: boolean;
  sortNearest: boolean;
  toggleCheapest: () => void;
  toggleNearest: () => void;
  postcode: string;
  setPostcode: (value: string) => void;
  onSearch: () => void;
  onUseLocation: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
};

export default function Controls({
  fuel,
  setFuel,
  sortCheapest,
  sortNearest,
  toggleCheapest,
  toggleNearest,
  postcode,
  setPostcode,
  onSearch,
  onUseLocation,
  theme,
  toggleTheme
}: ControlsProps) {
  return (
    <div className="controls">
      <div className="control-row">
        <div className="toggle-group" role="group" aria-label="Fuel type">
          <button
            className={fuel === "petrol" ? "active" : ""}
            onClick={() => setFuel("petrol")}
            type="button"
          >
            Petrol
          </button>
          <button
            className={fuel === "diesel" ? "active" : ""}
            onClick={() => setFuel("diesel")}
            type="button"
          >
            Diesel
          </button>
        </div>

        <div className="toggle-group" role="group" aria-label="Sort">
          <button
            className={sortCheapest ? "active" : ""}
            onClick={toggleCheapest}
            type="button"
          >
            Cheapest
          </button>
          <button
            className={sortNearest ? "active" : ""}
            onClick={toggleNearest}
            type="button"
          >
            Nearest
          </button>
        </div>

        <button className="pill" onClick={toggleTheme} type="button">
          {theme === "dark" ? "Dark mode" : "Light mode"}
        </button>
      </div>

      <div className="control-row">
        <input
          className="search-input"
          placeholder="Enter postcode"
          value={postcode}
          onChange={(event) => setPostcode(event.target.value)}
        />
        <button className="action-button" onClick={onSearch} type="button">
          Search
        </button>
        <button className="action-button primary" onClick={onUseLocation} type="button">
          Use my location
        </button>
      </div>
    </div>
  );
}
