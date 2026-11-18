// only display the value given from board, contain no state myself anymore
export default function Square({ number, onSquareClicked, winning }) {
  let visualClass = "square";
  if (winning == true) {
    visualClass += " win";
  }
  return (
    <button className={visualClass} onClick={onSquareClicked}>
      {number}
    </button>
  );
}
