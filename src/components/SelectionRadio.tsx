type SelectionRadioProps = {
  selected: boolean;
};

export function SelectionRadio({ selected }: SelectionRadioProps) {
  return (
    <span
      aria-hidden="true"
      className={`selection-radio-indicator ${selected ? "is-selected" : ""}`}
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        height: "100%"
      }}
    >
      <span
        className="selection-radio-indicator-dot"
        style={
          selected
            ? {
                position: "absolute",
                left: "50%",
                top: "50%",
                width: "15px",
                height: "15px",
                borderRadius: "50%",
                backgroundColor: "#123a7a",
                transform: "translate(-50%, -50%)",
                display: "block"
              }
            : {
                display: "none"
              }
        }
      />
    </span>
  );
}
